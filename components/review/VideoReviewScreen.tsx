"use client";

import { useEffect, useMemo, useState } from "react";
import ShareModal from "@/components/share-modal";
import TopBar from "@/components/review/TopBar";
import VideoStage from "@/components/VideoStage";
import PlaybackControls from "@/components/review/PlaybackControls";
import CommentComposerModal from "@/components/review/CommentComposerModal";
import CommentsPanel from "@/components/review/CommentsPanel";
import ApprovalStatusBar, { type ApprovalStatus, type ViewInfo } from "@/components/review/ApprovalStatusBar";
import RequestChangesModal from "@/components/review/RequestChangesModal";
import ChangeNoteBar from "@/components/review/ChangeNoteBar";
import DrawingOverlay from "@/components/review/DrawingOverlay";
import { useRouter } from "next/navigation";
import { useVideoPlayer } from "@/components/review/hooks/useVideoPlayer";

import VideoCompareScreen from "@/components/review/VideoCompareScreen";
import { getStackIdsForVideo, getNextIdInStack } from "@/lib/share/stackView";
import type { Annotation } from "@/lib/annotations/types";
import { isEmptyAnnotation } from "@/lib/annotations/types";
import { Undo2, Eraser, Check } from "lucide-react";

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
  isApprovalNote?: boolean;
  annotation?: Annotation | null;
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

  projectTitle?: string;

  // approval workflow (per-video)
  initialApprovalStatus?: ApprovalStatus;
  initialApprovalUpdatedAt?: string | null;

  // change notes between versions
  initialChangeNote?: string | null;

  // view receipts (owner-only, read-only)
  viewInfo?: ViewInfo | null;
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
    projectTitle,
    initialApprovalStatus,
    initialApprovalUpdatedAt,
    initialChangeNote,
    viewInfo,
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

  // Share token (if any) used to authenticate client-side API calls -- same
  // value for both the download and the signed-playback-token endpoints.
  const shareAuthToken = mode === "token" ? token : mode === "client" ? shareId : null;

  const downloadHref = useMemo(() => {
    const base = `/api/owner/videos/${videoId}/download`;
    return shareAuthToken ? `${base}?token=${encodeURIComponent(shareAuthToken)}` : base;
  }, [videoId, shareAuthToken]);

  const playbackTokenUrl = useMemo(() => {
    const base = `/api/videos/${videoId}/playback-token`;
    return shareAuthToken ? `${base}?token=${encodeURIComponent(shareAuthToken)}` : base;
  }, [videoId, shareAuthToken]);

  const player = useVideoPlayer({ playbackTokenUrl });

  // View receipts: record that the client opened this video (once per mount).
  useEffect(() => {
    if (isOwner || !shareAuthToken) return;

    fetch("/api/views/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: shareAuthToken, videoId }),
      keepalive: true,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, shareAuthToken, isOwner]);

  // Versions in the stack (for dropdown + compare)
  const versions = useMemo(() => getStackIdsForVideo(videoId, stacks), [videoId, stacks]);

  const currentLabel = videoMetaById[videoId]?.name ?? `Video ${videoId}`;

  // Next version in stack (for the version-switch dropdown/route prefetch;
  // no longer preloaded as a hidden <video> since that would need its own
  // signed playback token).
  const nextId = useMemo(() => getNextIdInStack(videoId, stacks), [videoId, stacks]);

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

  // Drawing / annotation (scoped to the comment currently being composed)
  const [draftAnnotation, setDraftAnnotation] = useState<Annotation | null>(null);
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const [viewingAnnotation, setViewingAnnotation] = useState<Annotation | null>(null);

  // A saved read-only annotation only makes sense while paused on that frame.
  useEffect(() => {
    if (player.isPlaying) setViewingAnnotation(null);
  }, [player.isPlaying]);

  // Approval workflow (per-video; resets when the videoId changes)
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(
    initialApprovalStatus ?? "PENDING"
  );
  const [approvalUpdatedAt, setApprovalUpdatedAt] = useState<string | null>(
    initialApprovalUpdatedAt ?? null
  );
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesNote, setRequestChangesNote] = useState("");
  const [requestChangesError, setRequestChangesError] = useState<string | null>(null);

  useEffect(() => {
    setApprovalStatus(initialApprovalStatus ?? "PENDING");
    setApprovalUpdatedAt(initialApprovalUpdatedAt ?? null);
  }, [videoId, initialApprovalStatus, initialApprovalUpdatedAt]);

  // Change note (per-video; only meaningful for non-first versions in a stack)
  const isFirstVersion = versions.length <= 1 || versions[0] === videoId;
  const [changeNote, setChangeNote] = useState(initialChangeNote ?? "");
  const [isSavingChangeNote, setIsSavingChangeNote] = useState(false);

  useEffect(() => {
    setChangeNote(initialChangeNote ?? "");
  }, [videoId, initialChangeNote]);

  async function saveChangeNote(next: string) {
    if (!isOwner) return;
    const prev = changeNote;
    setChangeNote(next);
    setIsSavingChangeNote(true);
    try {
      const res = await fetch(`/api/owner/videos/${videoId}/change-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: next }),
      });
      if (!res.ok) throw new Error("Failed to save note");
    } catch {
      setChangeNote(prev);
    } finally {
      setIsSavingChangeNote(false);
    }
  }

  // Below lg (see the layout grid below for why), comments render as a
  // full-screen overlay, so default to closed there (otherwise the video is
  // hidden behind comments on load).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 1023px)").matches) {
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
    setDraftAnnotation(null);
    setIsDrawingActive(false);
    setComposerOpen(true);
  };

  function handleViewAnnotation(c: ThreadedComment) {
    if (!c.annotation) return;
    player.pause();
    player.seekToMs(c.timecodeMs);
    setViewingAnnotation(c.annotation);
  }

  // Escape while actively drawing returns to the text composer rather than
  // closing everything (CommentComposerModal isn't mounted during drawing,
  // so it can't handle this itself).
  useEffect(() => {
    if (!isDrawingActive) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsDrawingActive(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDrawingActive]);

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
      annotation: !opts?.parentId ? draftAnnotation : null,
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
              annotation: !opts?.parentId && !isEmptyAnnotation(draftAnnotation) ? draftAnnotation : undefined,
            }
          : {
              videoId,
              body: trimmed,
              timecodeMs: Number(opts?.timecodeMs ?? stampMs ?? 0),
              parentId: opts?.parentId ?? null,
              annotation: !opts?.parentId && !isEmptyAnnotation(draftAnnotation) ? draftAnnotation : undefined,
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
        setDraftAnnotation(null);
        setIsDrawingActive(false);
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

  async function submitApproval(nextStatus: "APPROVED" | "CHANGES_REQUESTED", note?: string) {
    if (isToken && !token) return;
    if (mode === "client" && !shareId) return;
    if (!shareAuthToken) return;

    setIsSubmittingApproval(true);
    setRequestChangesError(null);

    try {
      const res = await fetch("/api/approvals/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: shareAuthToken,
          videoId,
          status: nextStatus,
          note,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update approval status");

      setApprovalStatus(data.video?.approvalStatus ?? nextStatus);
      setApprovalUpdatedAt(data.video?.approvalUpdatedAt ?? new Date().toISOString());

      if (data.comment) {
        setComments((prev) => [...prev, data.comment as ThreadedComment]);
      }

      if (nextStatus === "CHANGES_REQUESTED") {
        setRequestChangesOpen(false);
        setRequestChangesNote("");
      }
    } catch (e: any) {
      if (nextStatus === "CHANGES_REQUESTED") {
        setRequestChangesError(e?.message || "Failed to send request");
      } else {
        setCommentError(e?.message || "Failed to update approval status");
      }
    } finally {
      setIsSubmittingApproval(false);
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

  // Build compare versions model (ordered stack). Each side fetches its own
  // signed playback URL (see VideoCompareView) rather than being passed one.
  const compareVersions = useMemo(() => {
    return versions.map((id, idx) => ({
      id,
      label: `v${idx + 1}`,
    }));
  }, [versions]);

  const compareLeft = leftVersionId ?? videoId;
  const compareRight =
    rightVersionId ??
    versions.find((v) => v !== compareLeft) ??
    versions[0] ??
    videoId;

  const showCommentsPanel = !isComparing;

  return (
    <div className="bg-[var(--surface-0)] text-[var(--text-1)] flex flex-col h-[100dvh]">
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

      {!isComparing && (
        <ApprovalStatusBar
          isOwner={isOwner}
          canAct={canAddComment}
          status={approvalStatus}
          updatedAt={approvalUpdatedAt}
          isSubmitting={isSubmittingApproval}
          onApprove={() => submitApproval("APPROVED")}
          onRequestChanges={() => setRequestChangesOpen(true)}
          viewInfo={viewInfo}
        />
      )}

      {!isComparing && !isFirstVersion && (
        <ChangeNoteBar
          isOwner={isOwner}
          note={changeNote}
          onSave={saveChangeNote}
          isSaving={isSavingChangeNote}
        />
      )}

      {/* LAYOUT: hide comments column during compare.
          Below lg, comments render as a full-screen overlay (see CommentsPanel)
          instead of a side column, so the grid only ever has one real track.
          This is deliberately lg (1024px), not md (768px): a fixed 380px
          sidebar at md would eat most of the width on a portrait tablet
          (e.g. iPad at 768x1024), squeezing the video into a narrow column
          with huge unused letterbox bars above/below it. */}
      <div
        className={[
          "flex-1 min-h-0 overflow-hidden relative grid grid-cols-1",
          "lg:transition-[grid-template-columns] lg:duration-300 lg:ease-in-out",
          showCommentsPanel && commentsOpen
            ? "lg:grid-cols-[1fr_380px]"
            : "lg:grid-cols-[1fr_0px]",
        ].join(" ")}
      >
        <section ref={player.viewerRef} className="relative min-h-0 flex flex-col overflow-hidden">
          {/* COMPARE MODE */}
          {isComparing ? (
            <div className="flex-1 min-h-0">
              <VideoCompareScreen
                baseVideoId={videoId}
                versions={compareVersions}
                shareAuthToken={shareAuthToken}
                defaultLeftId={compareLeft}
                defaultRightId={compareRight}
              />
            </div>
          ) : (
            <>
              {/* SINGLE VIEW */}
              <div className="relative flex-1 min-h-0">
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

                {isDrawingActive && (
                  <>
                    <DrawingOverlay
                      videoRef={player.videoRef}
                      interactive
                      value={draftAnnotation ?? { strokes: [] }}
                      onChange={setDraftAnnotation}
                    />

                    <div className="absolute inset-x-0 bottom-3 flex justify-center px-4">
                      <div className="flex items-center gap-2 rounded-xl border border-[var(--border-1)] bg-[var(--surface-0)]/95 px-3 py-2 shadow-2xl backdrop-blur">
                        <button
                          type="button"
                          onClick={() =>
                            setDraftAnnotation((prev) =>
                              prev && prev.strokes.length > 0
                                ? { strokes: prev.strokes.slice(0, -1) }
                                : prev
                            )
                          }
                          disabled={!draftAnnotation || draftAnnotation.strokes.length === 0}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-40"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Undo
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraftAnnotation({ strokes: [] })}
                          disabled={!draftAnnotation || draftAnnotation.strokes.length === 0}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-40"
                        >
                          <Eraser className="h-3.5 w-3.5" />
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDrawingActive(false)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-solid)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Done
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {!isDrawingActive && viewingAnnotation && (
                  <DrawingOverlay
                    videoRef={player.videoRef}
                    interactive={false}
                    value={viewingAnnotation}
                  />
                )}
              </div>

              <div className="shrink-0 bg-[var(--surface-0)]/90 backdrop-blur">
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
                open={composerOpen && !isDrawingActive}
                onClose={() => setComposerOpen(false)}
                stampLabel={player.formatTime(stampMs)}
                body={commentBody}
                onBodyChange={setCommentBody}
                onSubmit={() => handlePostComment()}
                isPosting={isPosting}
                error={commentError}
                initials="BE"
                hasAnnotation={!isEmptyAnnotation(draftAnnotation)}
                onStartDrawing={() => setIsDrawingActive(true)}
                onRemoveAnnotation={() => setDraftAnnotation(null)}
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
            onViewAnnotation={handleViewAnnotation}
          />
        )}
      </div>

      {!isToken && (
        <ShareModal open={isShareOpen} onClose={() => setIsShareOpen(false)} videoId={videoId} />
      )}

      {!isOwner && (
        <RequestChangesModal
          open={requestChangesOpen}
          onClose={() => {
            setRequestChangesOpen(false);
            setRequestChangesError(null);
          }}
          note={requestChangesNote}
          onNoteChange={setRequestChangesNote}
          onSubmit={() => submitApproval("CHANGES_REQUESTED", requestChangesNote)}
          isSubmitting={isSubmittingApproval}
          error={requestChangesError}
        />
      )}
    </div>
  );
}