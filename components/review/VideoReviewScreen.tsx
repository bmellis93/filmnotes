"use client";

import { useEffect, useMemo, useState } from "react";
import ShareModal from "@/components/share-modal";
import TopBar from "@/components/review/TopBar";
import VideoStage from "@/components/VideoStage";
import PlaybackControls from "@/components/review/PlaybackControls";
import CommentComposerModal from "@/components/review/CommentComposerModal";
import CommentsPanel from "@/components/review/CommentsPanel";
import { useRouter } from "next/navigation";
import { useVideoPlayer } from "@/components/review/hooks/useVideoPlayer";

import VideoCompareScreen from "@/components/review/VideoCompareScreen";
import { getStackIdsForVideo, getNextIdInStack } from "@/lib/share/stackView";

function makeTempId() {
  return `temp_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export type ThreadedComment = {
  id: string;
  timecodeMs: number;
  body: string;
  author: string | null;
  createdAt: string;
  parentId: string | null;
  replies: ThreadedComment[];
  role?: "OWNER" | "CLIENT";
  status?: "OPEN" | "RESOLVED";
};

type Props = {
  videoId: string;
  mode?: "owner" | "token" | "client";
  token?: string;
  shareId?: string;

  view?: "VIEW_ONLY" | "REVIEW_DOWNLOAD";
  backHref?: string;

  permissions?: {
    allowComments?: boolean;
    allowDownload?: boolean;
  };

  // stack + metadata
  stacks?: Record<string, string[]>;
  videoMetaById?: Record<
    string,
    { name: string; description?: string; createdAt?: string; thumbnailUrl?: string | null }
  >;
  sourcesById?: Record<string, { viewSrc: string; originalSrc: string }>;

  projectTitle?: string;
};

export default function VideoReviewScreen(props: Props) {
  const {
    videoId,
    mode = "owner",
    token,
    shareId,
    permissions,
    view = "REVIEW_DOWNLOAD",
    backHref,
    stacks: stacksProp,
    videoMetaById: videoMetaByIdProp,
    sourcesById: sourcesByIdProp,
    projectTitle,
  } = props;

  const router = useRouter();

  const isToken = mode === "token";
  const isOwner = mode === "owner";

  const canAddComment =
    mode === "owner" ? true : view !== "VIEW_ONLY" && Boolean(permissions?.allowComments);

  // Download is a client-side action (their copy of the delivered footage);
  // the owner already has the original, so no download button for them.
  const canDownload =
    !isOwner && view !== "VIEW_ONLY" && Boolean(permissions?.allowDownload);

  const stacks = stacksProp ?? {};
  const videoMetaById = videoMetaByIdProp ?? {};
  const sourcesById = sourcesByIdProp ?? {};

  const sources = sourcesById[videoId];
  const viewSrc = sources?.viewSrc ?? "";

  const downloadHref = useMemo(() => {
    const base = `/api/owner/videos/${videoId}/download`;
    const shareToken = mode === "token" ? token : mode === "client" ? shareId : null;
    return shareToken ? `${base}?token=${encodeURIComponent(shareToken)}` : base;
  }, [videoId, mode, token, shareId]);

  const player = useVideoPlayer({ src: viewSrc });

  // Versions in the stack (for dropdown + compare)
  const versions = useMemo(() => getStackIdsForVideo(videoId, stacks), [videoId, stacks]);

  const currentLabel = videoMetaById[videoId]?.name ?? `Video ${videoId}`;

  // Preload next version in stack (single-view only)
  const nextId = useMemo(() => getNextIdInStack(videoId, stacks), [videoId, stacks]);
  const nextSrc = nextId ? sourcesById[nextId]?.viewSrc : undefined;

  const nextRoute = useMemo(() => {
    if (!nextId) return null;

    if (mode === "token" && token) return `/r/${token}/videos/${nextId}`;

    if (mode === "owner" && backHref) {
      return `${backHref}/videos/${nextId}`;
    }

    if (mode === "client" && shareId) return `/share/${shareId}/videos/${nextId}`;

    return null;
  }, [mode, token, shareId, backHref, nextId]);

  useEffect(() => {
    if (nextRoute) router.prefetch(nextRoute);
  }, [nextRoute, router]);

  const [isShareOpen, setIsShareOpen] = useState(false);

  const [comments, setComments] = useState<ThreadedComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [commentBody, setCommentBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [stampMs, setStampMs] = useState<number>(0);

  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(true);

  // On mobile, comments render as a full-screen overlay, so default to
  // closed there (otherwise the video is hidden behind comments on load).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setCommentsOpen(false);
    }
  }, []);

  // Compare mode state
  const [isComparing, setIsComparing] = useState(false);
  const [leftVersionId, setLeftVersionId] = useState<string | null>(null);
  const [rightVersionId, setRightVersionId] = useState<string | null>(null);

  const canCompare = versions.length >= 2;

  const handleAddComment = () => {
    if (!canAddComment) return;
    player.pause();
    setStampMs(player.getCurrentTimeMs());
    setComposerOpen(true);
  };

  useEffect(() => {
    if (isToken) setIsShareOpen(false);
  }, [isToken]);

  // Load comments (still fine to load; we just hide panel during compare)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (mode === "token" && !token) {
        setIsLoadingComments(false);
        return;
      }

      try {
        setIsLoadingComments(true);
        setCommentError(null);

        const url = mode === "token" ? "/api/comments/list" : "/api/comments/list-owner";
        const body = mode === "token" ? { token, videoId } : { videoId };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load comments");

        if (!cancelled) setComments(data.comments || []);
      } catch (err: any) {
        if (!cancelled) setCommentError(err?.message || "Failed to load comments");
      } finally {
        if (!cancelled) setIsLoadingComments(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, token, videoId]);

  function enterComparisonView() {
    if (!canCompare) return;

    // Pause single-view player, close composer, hide comments
    player.pause();
    setComposerOpen(false);
    setCommentsOpen(false);

    // Default picks: current on left, some other on right
    setLeftVersionId(videoId);
    setRightVersionId(versions.find((v) => v !== videoId) ?? versions[0] ?? videoId);

    setIsComparing(true);
  }

  function exitComparisonView() {
    setIsComparing(false);
  }

  function toggleCompare() {
    if (isComparing) exitComparisonView();
    else enterComparisonView();
  }

  async function handlePostComment(opts?: { parentId?: string; timecodeMs?: number }) {
    if (!canAddComment) return;

    const trimmed = (opts?.parentId ? replyBody : commentBody).trim();
    if (!trimmed) {
      setCommentError("Type a comment first.");
      return;
    }

    const tempId = makeTempId();

    const optimistic: ThreadedComment = {
      id: tempId,
      timecodeMs: Number(opts?.timecodeMs ?? stampMs ?? 0),
      body: trimmed,
      author: mode === "owner" ? "Owner" : null,
      createdAt: new Date().toISOString(),
      parentId: opts?.parentId ?? null,
      replies: [],
      role: mode === "owner" ? "OWNER" : "CLIENT",
    };

    setComments((prev) => {
      const parentId = opts?.parentId;
      if (!parentId) return [...prev, optimistic];

      const insertReply = (list: ThreadedComment[]): ThreadedComment[] =>
        list.map((c) => {
          if (c.id === parentId) {
            return { ...c, replies: [...(c.replies || []), optimistic] };
          }
          return { ...c, replies: insertReply(c.replies || []) };
        });

      return insertReply(prev);
    });

    try {
      setCommentError(null);
      opts?.parentId ? setIsReplying(true) : setIsPosting(true);

      const url = mode === "token" ? "/api/comments/create" : "/api/comments/create-owner";

      if (mode === "token" && !token) {
        throw new Error("Missing token. Refresh and try again.");
      }

      const payload =
        mode === "token"
          ? {
              token,
              videoId,
              body: trimmed,
              timecodeMs: Number(opts?.timecodeMs ?? stampMs ?? 0),
              parentId: opts?.parentId ?? null,
            }
          : {
              videoId,
              body: trimmed,
              timecodeMs: Number(opts?.timecodeMs ?? stampMs ?? 0),
              parentId: opts?.parentId ?? null,
            };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to post comment");

      const real = data.comment as ThreadedComment;

      setComments((prev) => {
        const replace = (list: ThreadedComment[]): ThreadedComment[] =>
          list.map((c) => {
            if (c.id === tempId) return { ...real, replies: c.replies ?? [] };
            return { ...c, replies: replace(c.replies || []) };
          });

        return replace(prev);
      });

      if (opts?.parentId) {
        setReplyBody("");
        setReplyToId(null);
      } else {
        setCommentBody("");
        setComposerOpen(false);
      }
    } catch (e: any) {
      setComments((prev) => {
        const remove = (list: ThreadedComment[]): ThreadedComment[] =>
          list
            .filter((c) => c.id !== tempId)
            .map((c) => ({ ...c, replies: remove(c.replies || []) }));

        return remove(prev);
      });

      setCommentError(e?.message || "Failed to post comment");
    } finally {
      setIsPosting(false);
      setIsReplying(false);
    }
  }

  function updateCommentStatusInTree(
    list: ThreadedComment[],
    commentId: string,
    nextStatus: "OPEN" | "RESOLVED"
  ): ThreadedComment[] {
    return list.map((c) => {
      if (c.id === commentId) return { ...c, status: nextStatus };
      return {
        ...c,
        replies: updateCommentStatusInTree(c.replies || [], commentId, nextStatus),
      };
    });
  }

  async function handleToggleResolved(commentId: string, resolved: boolean) {
    if (!isOwner) return;

    const nextStatus: "OPEN" | "RESOLVED" = resolved ? "RESOLVED" : "OPEN";
    const rollbackStatus: "OPEN" | "RESOLVED" = resolved ? "OPEN" : "RESOLVED";

    setComments((prev) => updateCommentStatusInTree(prev, commentId, nextStatus));

    try {
      const res = await fetch("/api/comments/toggle-resolved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, resolved }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to toggle resolved");

      const serverStatus = data.updated?.status as "OPEN" | "RESOLVED" | undefined;
      if (serverStatus) {
        setComments((prev) => updateCommentStatusInTree(prev, commentId, serverStatus));
      }
    } catch (e: any) {
      setComments((prev) => updateCommentStatusInTree(prev, commentId, rollbackStatus));
      setCommentError(e?.message || "Failed to toggle resolved");
    }
  }

  // Build compare versions model (ordered stack)
  const compareVersions = useMemo(() => {
    return versions.map((id, idx) => ({
      id,
      label: `v${idx + 1}`,
      viewSrc: sourcesById[id]?.viewSrc ?? "",
    }));
  }, [versions, sourcesById]);

  const compareLeft = leftVersionId ?? videoId;
  const compareRight =
    rightVersionId ??
    versions.find((v) => v !== compareLeft) ??
    versions[0] ??
    videoId;

  const showCommentsPanel = !isComparing;

  return (
    <div className="bg-neutral-950 text-neutral-100 flex flex-col h-[100dvh]">
      <TopBar
        onBack={() => {
          if (backHref) router.push(backHref);
          else router.back();
        }}
        projectTitle={projectTitle ?? "Client Gallery"}
        videoTitle={currentLabel}
        version={videoId}
        versions={versions}
        onVersionChange={(nextId) => {
          if (!nextId || nextId === videoId) return;

          // If they change versions while comparing, exit compare so URL/state stays sane.
          if (isComparing) setIsComparing(false);

          if (mode === "token" && token) router.push(`/r/${token}/videos/${nextId}`);
          else if (mode === "client" && shareId) router.push(`/share/${shareId}/videos/${nextId}`);
          else if (mode === "owner" && backHref) router.push(`${backHref}/videos/${nextId}`);
          else router.push(`/videos/${nextId}`);
        }}
        canCompare={canCompare}
        isComparing={isComparing}
        onToggleCompare={toggleCompare}
        onSelectCompare={enterComparisonView}
        canDownload={canDownload}
        canShare={isOwner}
        onShare={() => setIsShareOpen(true)}
        onDownload={() => {
          window.location.href = downloadHref;
        }}
        commentsOpen={commentsOpen}
        onToggleComments={() => {
          if (isComparing) return;
          setCommentsOpen((v) => !v);
        }}
      />

      {/* LAYOUT: hide comments column during compare.
          Below md, comments render as a full-screen overlay (see CommentsPanel)
          instead of a side column, so the grid only ever has one real track. */}
      <div
        className={[
          "flex-1 min-h-0 overflow-hidden relative grid grid-cols-1",
          "md:transition-[grid-template-columns] md:duration-300 md:ease-in-out",
          showCommentsPanel && commentsOpen
            ? "md:grid-cols-[1fr_380px]"
            : "md:grid-cols-[1fr_0px]",
        ].join(" ")}
      >
        <section ref={player.viewerRef} className="relative min-h-0 flex flex-col overflow-hidden">
          {/* COMPARE MODE */}
          {isComparing ? (
            <div className="flex-1 min-h-0">
              <VideoCompareScreen
                baseVideoId={videoId}
                versions={compareVersions}
                defaultLeftId={compareLeft}
                defaultRightId={compareRight}
              />
            </div>
          ) : (
            <>
              {/* SINGLE VIEW */}
              <div className="flex-1 min-h-0">
                <VideoStage
                  ref={player.videoRef}
                  className="h-full"
                  onLoadedMetadata={player.syncDuration}
                  onLoadedData={player.syncDuration}
                  onCanPlay={player.syncDuration}
                  onDurationChange={player.syncDuration}
                  onPlay={player.onPlay}
                  onPause={player.onPause}
                  onTimeUpdate={player.onTimeUpdate}
                />

                {nextSrc ? (
                  <video
                    src={nextSrc}
                    preload="auto"
                    style={{ display: "none" }}
                    muted
                    playsInline
                  />
                ) : null}
              </div>

              <div className="shrink-0 bg-neutral-950/90 backdrop-blur">
                <PlaybackControls
                  isPlaying={player.isPlaying}
                  onTogglePlay={player.togglePlay}
                  currentMs={player.currentMs}
                  durationMs={player.durationMs}
                  onSeek={player.seekToMs}
                  formatTime={player.formatTime}
                  markers={comments.map((c) => ({ id: c.id, timecodeMs: c.timecodeMs }))}
                  volume={player.volume}
                  muted={player.muted}
                  onToggleMute={player.toggleMute}
                  onVolumeChange={player.setVolumeSafe}
                  canAddComment={canAddComment}
                  onAddComment={handleAddComment}
                  loop={player.loop}
                  onToggleLoop={() => player.setLoop((v) => !v)}
                  playbackRate={player.playbackRate}
                  onPlaybackRateChange={player.setPlaybackRate}
                  qualityLevels={player.qualityLevels}
                  currentQualityIndex={player.currentQualityIndex}
                  isAutoQuality={player.isAutoQuality}
                  isHlsActive={player.isHlsActive}
                  onQualityChange={player.setQualityLevel}
                  isFullscreen={player.isFullscreen}
                  onToggleFullscreen={player.toggleFullscreen}
                />
              </div>

              <CommentComposerModal
                open={composerOpen}
                onClose={() => setComposerOpen(false)}
                stampLabel={player.formatTime(stampMs)}
                body={commentBody}
                onBodyChange={setCommentBody}
                onSubmit={() => handlePostComment()}
                isPosting={isPosting}
                error={commentError}
                initials="BE"
              />
            </>
          )}
        </section>

        {/* COMMENTS (HIDDEN DURING COMPARE) */}
        {showCommentsPanel && (
          <CommentsPanel
            isToken={isToken}
            isOwner={isOwner}
            onToggleResolved={handleToggleResolved}
            commentsOpen={commentsOpen}
            comments={comments}
            isLoadingComments={isLoadingComments}
            commentError={commentError}
            canAddComment={canAddComment}
            replyToId={replyToId}
            setReplyToId={setReplyToId}
            replyBody={replyBody}
            setReplyBody={setReplyBody}
            isReplying={isReplying}
            onSeek={player.seekToMs}
            formatTime={player.formatTime}
            onReplySubmit={({ parentId, timecodeMs }) =>
              handlePostComment({ parentId, timecodeMs })
            }
          />
        )}
      </div>

      {!isToken && (
        <ShareModal open={isShareOpen} onClose={() => setIsShareOpen(false)} videoId={videoId} />
      )}
    </div>
  );
}