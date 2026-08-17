// components/owner/GalleryDetailScreen.tsx
"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Share2, Upload, ArrowLeft, Layers, Link2 } from "lucide-react";

import UploadDropzone from "@/components/owner/UploadDropzone";
import VideoGrid, { GalleryVideo } from "@/components/owner/VideoGrid";

import UploadVideoModal from "@/components/owner/UploadVideoModal";
import ShareGalleryModal from "@/components/owner/ShareGalleryModal";
import ShareModal from "@/components/share-modal";
import ManageSharesModal from "@/components/owner/ManageSharesModal";
import ManageVersionsModal from "@/components/owner/ManageVersionsModal";
import EditThumbnailModal from "@/components/owner/EditThumbnailModal";
import Button from "@/components/ui/Button";

import type { StackMap } from "@/components/domain/stacks";

import { useToast } from "@/components/ui/toast";

import { logUploadFailure } from "@/lib/telemetry";

import {
  getVisibleVideos,
  buildById,
  buildChildToParent,
  getParentId,
  getStackIds,
  isStackParent,
  latestIdForCard,
  nextStacksFromOrder,
  mergeStacksForDnD,
  unstackPreserveOrder,
} from "@/components/owner/domain/videoStacks";

type Props = {
  gallery: { id: string; name: string; description?: string };
  initialVideos: GalleryVideo[];
  initialStacks: StackMap;
  // Lets the embed dashboard (app/embed/galleries/[id]) reuse this
  // component unmodified while navigating within /embed/* instead of
  // /owner/*. Doubles as both the galleries-list root (the "back" button)
  // and the prefix for this gallery's own detail/video routes.
  basePath?: string;
};

export default function GalleryDetailScreen({
  gallery,
  initialVideos,
  initialStacks,
  basePath = "/owner/galleries",
}: Props) {
  const router = useRouter();
  const galleryId = gallery.id;
  const { toast } = useToast();

  const [videos, setVideos] = useState<GalleryVideo[]>(initialVideos);
  const [stacks, setStacks] = useState<StackMap>(initialStacks);

  // Modals
  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareVideoId, setShareVideoId] = useState<string | null>(null);
  const [manageSharesOpen, setManageSharesOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [retryForVideoId, setRetryForVideoId] = useState<string | null>(null);
  const [editThumbnailVideoId, setEditThumbnailVideoId] = useState<string | null>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const showSelectionUI = selectedIds.length > 0;

  // Manage versions modal state
  const [manageParentId, setManageParentId] = useState<string | null>(null);

  // Drag/drop UI
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // ---- derived helpers ----
  const byId = useMemo(() => buildById(videos), [videos]);

  const retryDefaults = useMemo(() => {
    if (!retryForVideoId) return null;
    const v = byId.get(retryForVideoId);
    if (!v) return null;
    return { title: v.name, description: v.description };
  }, [retryForVideoId, byId]);

  const childToParent = useMemo(() => buildChildToParent(stacks), [stacks]);
  const visibleVideos = useMemo(() => getVisibleVideos(videos, stacks), [videos, stacks]);
  const [showArchived, setShowArchived] = useState(false);

  const visibleForGrid = useMemo(() => {
    const base = visibleVideos;
    const filtered = showArchived ? base : base.filter((v) => !v.archivedAt);
    // Recompute from live stacks state so the "vN" badge doesn't go stale
    // after stack/unstack/reorder actions (server-computed initialVideos
    // only reflects the count at page load).
    return filtered.map((v) => ({
      ...v,
      versionsCount: getStackIds(v.id, stacks).length,
    }));
  }, [visibleVideos, showArchived, stacks]);

  // Gallery-level share: every non-archived, playable video, including every
  // version in a stack (not just the latest) so clients can still switch versions.
  const shareableVideoIds = useMemo(() => {
    return visibleVideos
      .filter((v) => !v.archivedAt)
      .flatMap((v) => getStackIds(v.id, stacks))
      .filter((id) => byId.get(id)?.status === "READY");
  }, [visibleVideos, stacks, byId]);

  const inflightReal = useMemo(() => {
    return videos.filter(
      (v) =>
        !v.id.startsWith("temp_") &&
        (v.status === "UPLOADING" || v.status === "UPLOADED" || v.status === "PROCESSING")
    );
  }, [videos]);

  const loggedFailuresRef = useRef<Set<string>>(new Set());

  const inflightCount = inflightReal.length;

  const oldestInflightMs = useMemo(() => {
    const times = inflightReal
      .map((v) => {
        const t = Date.parse(v.createdAt ?? "");
        return Number.isFinite(t) ? t : NaN;
      })
      .filter((t) => Number.isFinite(t)) as number[];

    if (times.length === 0) return null;
    return Date.now() - Math.min(...times);
  }, [inflightReal]);

  const inflightStuck = oldestInflightMs != null && oldestInflightMs > 12 * 60 * 1000; // 12 min

  const canCreateStack = useMemo(() => {
    if (selectedIds.length < 2) return false;
    const selected = new Set(selectedIds);
    const picked = videos.filter((v) => selected.has(v.id));
    return picked.every((v) => v.status === "READY" && !v.archivedAt && !v.id.startsWith("temp_"));
  }, [selectedIds, videos]);

  const [pendingUpload, setPendingUpload] = useState<{
    file: File;
    tempId: string;
  } | null>(null);

  const videosRef = useRef<GalleryVideo[]>(videos);
    useEffect(() => {
      videosRef.current = videos;
    }, [videos]);

    const byIdRef = useRef(byId);
    useEffect(() => {
      byIdRef.current = byId;
    }, [byId]);
  
  function handleFiles(files: File[]) {
    const file = files?.[0] ?? null;
    if (!file) return;

    const tempId = `temp_${crypto.randomUUID()}`;

    // ✅ optimistic card shows immediately
    setVideos((prev) => [
      {
        id: tempId,
        name: file.name.replace(/\.[^/.]+$/, ""),
        description: "",
        status: "UPLOADING",
        createdAt: new Date().toISOString(),
        thumbnailUrl: null,
        versionsCount: 1,
        originalSize: file.size,
      },
      ...prev,
    ]);

    setPendingUpload({ file, tempId });
    setUploadOpen(true);
  }
  
  function toggleSelect(videoId: string) {
    setSelectedIds((prev) =>
      prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [...prev, videoId]
    );
  }

  function dbToUiStatus(s: string): GalleryVideo["status"] {
    switch (s) {
      case "READY":
      case "FAILED":
      case "UPLOADING":
      case "UPLOADED":
      case "PROCESSING":
        return s;
      default:
        // safest: keep as PROCESSING if it's an in-flight unknown,
        // but you might want to log it once.
        return "PROCESSING";
    }
  }

  const selectedVideos = useMemo(() => {
    const s = new Set(selectedIds);
    return videos.filter((v) => s.has(v.id));
  }, [videos, selectedIds]);

  /**
   * Persist stacks + grid ordering to the server.
   * - Optimistic UI: we update state first, then persist.
   * - If the save fails, we log it (you can add a toast later).
   */
  const persistStacks = useCallback(
    async (nextStacks: StackMap, orderedIds: string[]) => {
      try {
        const res = await fetch("/api/owner/galleries/update-stacks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            galleryId,
            stacks: nextStacks,
            orderedIds, // ✅ always a string[]
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("update-stacks failed:", res.status, text);
        }
      } catch (err) {
        console.error("update-stacks error:", err);
      }
    },
    [galleryId]
  );

  // Helper: compute parent/visible ordering for arbitrary state (avoid using stale memo in callbacks)
  const computeGridOrder = useCallback((nextVideos: GalleryVideo[], nextStacks: StackMap) => {
    return getVisibleVideos(nextVideos, nextStacks).map((v) => v.id);
  }, []);

  // ---- mutations via domain helper ----
  const applyStackOrder = useCallback(
    (stackOrderedIds: string[]) => {
      const result = nextStacksFromOrder({ orderedIds: stackOrderedIds, videos, stacks });
      if (!result) return;

      // optimistic UI
      setStacks(result.nextStacks);
      setSelectedIds([]);

      // persist (grid order, not stack order)
      const nextGridOrder = computeGridOrder(videos, result.nextStacks);
      void persistStacks(result.nextStacks, nextGridOrder);
    },
    [videos, stacks, persistStacks, computeGridOrder]
  );

  const handleOpenCard = useCallback(
    (cardId: string) => {
      const openId = latestIdForCard(cardId, stacks, childToParent);
      
      const v = byIdRef.current.get(openId);
      if (v && v.status !== "READY") {
        toast({
          kind: "info",
          title: "Still processing",
          message: "This video isn’t ready yet. Give it a moment and try again.",
        });
        return;
      }
      
      router.push(`${basePath}/${galleryId}/videos/${openId}`);
    },
    [router, galleryId, stacks, childToParent]
  );

  const openManageFor = useCallback(
    (videoId: string) => {
      const parentId = getParentId(videoId, childToParent);
      if (!isStackParent(parentId, stacks)) return;

      setManageParentId(parentId);
      setManageOpen(true);
    },
    [childToParent, stacks]
  );

  const unstack = useCallback(
    (videoId: string) => {
      const parentId = getParentId(videoId, childToParent);
      const result = unstackPreserveOrder({ parentId, videos, stacks });
      if (!result) return;

      // optimistic UI
      setVideos(result.nextVideos);
      setStacks(result.nextStacks);
      setSelectedIds((prev) => prev.filter((id) => !result.stackIds.includes(id)));

      // persist (use the *new* videos + stacks)
      const nextGridOrder = computeGridOrder(result.nextVideos, result.nextStacks);
      void persistStacks(result.nextStacks, nextGridOrder);
    },
    [videos, stacks, childToParent, persistStacks, computeGridOrder]
  );

  // ---- drag/drop stacking ----
  const onDragStartCard = useCallback((videoId: string) => {
    setDraggingId(videoId);
  }, []);

  const onDragEndCard = useCallback(() => {
    setDraggingId(null);
    setDropTargetId(null);
  }, []);

  const onDragOverCard = useCallback(
    (targetId: string) => {
      if (!draggingId) return;

      const target = byIdRef.current.get(targetId);
      if (!target || target.status !== "READY" || target.archivedAt) {
        setDropTargetId(null);
        return;
      }

      const merged = mergeStacksForDnD({ sourceId: draggingId, targetId, stacks, videos });
      if (!merged) {
        setDropTargetId(null);
        return;
      }

      const parentTargetId = getParentId(targetId, childToParent);
      setDropTargetId(parentTargetId);
    },
    [draggingId, stacks, videos, childToParent]
  );

  const onDropOnCard = useCallback(
    (targetId: string) => {
      if (!draggingId) return;

      const target = byIdRef.current.get(targetId);
      if (!target || target.status !== "READY" || target.archivedAt) {
        setDraggingId(null);
        setDropTargetId(null);
        return;
      }

      const merged = mergeStacksForDnD({ sourceId: draggingId, targetId, stacks, videos });
      if (!merged) {
        setDraggingId(null);
        setDropTargetId(null);
        return;
      }

      const result = nextStacksFromOrder({ orderedIds: merged, videos, stacks });
      if (!result) {
        setDraggingId(null);
        setDropTargetId(null);
        return;
      }

      // optimistic UI
      setStacks(result.nextStacks);
      setSelectedIds([]);

      setDraggingId(null);
      setDropTargetId(null);

      // persist (grid order)
      const nextGridOrder = computeGridOrder(videos, result.nextStacks);
      void persistStacks(result.nextStacks, nextGridOrder);
    },
    [draggingId, stacks, videos, persistStacks, computeGridOrder]
  );

  function patchVideo(id: string, patch: Partial<GalleryVideo>) {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  const pollForceRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const delayRef = { current: 2000 }; // start at 2s

    const schedule = (ms: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };

    const tick = async () => {
      if (cancelled) return;

      const inflight = videosRef.current.filter(
        (v) =>
          !v.id.startsWith("temp_") &&
          (v.status === "UPLOADING" || v.status === "UPLOADED" || v.status === "PROCESSING")
      );

      // nothing to poll → stop
      if (inflight.length === 0) {
        delayRef.current = 2000;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        return;
      }

      const ids = inflight.map((v) => v.id);

      try {
        const res = await fetch("/api/owner/videos/status-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoIds: ids }),
          cache: "no-store",
        });

        if (!res.ok) {
          delayRef.current = Math.min(8000, Math.round(delayRef.current * 1.25));
          schedule(delayRef.current);
          return;
        }

        const json = (await res.json().catch(() => null)) as
          | {
              ok: true;
              videos: {
                id: string;
                status: string;
                thumbnailUrl: string | null;
                playbackUrl: string | null;
                title: string | null;
                description: string | null;
                archivedAt: string | null;
                originalSize: number | null;
                failureReason?: string | null; // 12.2 support (optional)
                createdAt: string;
              }[];
            }
          | null;

        if (!json?.ok || !Array.isArray(json.videos) || cancelled) {
          delayRef.current = Math.min(8000, Math.round(delayRef.current * 1.25));
          schedule(delayRef.current);
          return;
        }

        let progressed = false;

        for (const v of json.videos) {
          const nextStatus = dbToUiStatus(v.status);
          if (nextStatus === "READY" || nextStatus === "FAILED") progressed = true;

          if (nextStatus === "FAILED") {
            const seen = loggedFailuresRef.current;
            if (!seen.has(v.id)) {
              seen.add(v.id);
              logUploadFailure({
                where: "POLL",
                videoId: v.id,
                reason: v.failureReason ?? null,
              });
            }
          }

          patchVideo(v.id, {
            status: nextStatus,
            thumbnailUrl: v.thumbnailUrl ?? null,
            playbackUrl: v.playbackUrl ?? null,
            name: v.title ?? byIdRef.current.get(v.id)?.name ?? "Untitled",
            description: v.description ?? "",
            archivedAt: v.archivedAt ?? null,
            ...(typeof v.originalSize === "number" ? { originalSize: v.originalSize } : {}),
            ...(typeof v.failureReason === "string" ? { failureReason: v.failureReason } : {}),
          });
        }

        delayRef.current = progressed ? 2000 : Math.min(8000, Math.round(delayRef.current * 1.25));
        schedule(delayRef.current);
      } catch {
        delayRef.current = Math.min(8000, Math.round(delayRef.current * 1.25));
        schedule(delayRef.current);
      }
    };

    // expose a "force poll now" function
    pollForceRef.current = () => {
      delayRef.current = 2000;
      schedule(0);
    };

    // kick once on mount
    schedule(0);

    return () => {
      cancelled = true;
      pollForceRef.current = null;
      if (timer) clearTimeout(timer);
    };
  }, []); // mount once

  function replaceVideoId(oldId: string, newId: string) {
    setVideos((prev) => prev.map((v) => (v.id === oldId ? { ...v, id: newId } : v)));
  }
  
  // ---- modal data ----
  const manageVideos = useMemo(() => {
    if (!manageParentId) return [];
    const stackIds = stacks[manageParentId] ?? [];
    return stackIds.map((id) => byId.get(id)).filter(Boolean) as GalleryVideo[];
  }, [manageParentId, stacks, byId]);

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 border-b border-[var(--border-2)] bg-[var(--surface-0)]/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => router.push(basePath)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 text-[var(--text-2)] hover:bg-[var(--surface-1)]"
                aria-label="Back to galleries"
                title="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-[var(--text-1)]">{gallery.name}</div>
                {gallery.description ? (
                  <div className="truncate text-sm text-[var(--text-muted)]">{gallery.description}</div>
                ) : (
                  <div className="text-sm text-[var(--text-muted)]">No description</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showSelectionUI && (
                <>
                  <Button
                    onClick={() => {
                      setManageParentId(null);
                      setManageOpen(true);
                    }}
                    disabled={!canCreateStack}
                    title={canCreateStack ? "Create a version stack" : "Select at least 2 videos"}
                  >
                    <Layers className="h-4 w-4" />
                    Create Version Stack
                  </Button>

                  <Button
                    variant="secondary"
                    title="Archived videos still count toward storage."
                    onClick={async () => {
                      if (!confirm(`Archive ${selectedIds.length} video(s)?`)) return;

                      const realIds = selectedIds.filter((id) => !id.startsWith("temp_"));
                      if (realIds.length === 0) return;

                      await fetch("/api/owner/videos/bulk", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "ARCHIVE", videoIds: realIds  }),
                      });

                      const now = new Date().toISOString();
                      setVideos((prev) =>
                        prev.map((v) => (realIds.includes(v.id) ? { ...v, archivedAt: now } : v))
                      );
                      setSelectedIds([]);
                    }}
                  >
                    Archive
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={async () => {
                      const bytes = selectedVideos
                        .filter((v) => selectedIds.includes(v.id))
                        .reduce((acc, v) => acc + (v.originalSize ?? 0), 0);

                      const gb = bytes / (1024 ** 3);
                      const gbLabel = gb >= 10 ? gb.toFixed(0) : gb.toFixed(1);

                      if (!confirm(`Deleting these videos will free ${gbLabel} GB.\n\nContinue?`)) return;

                      const realIds = selectedIds.filter((id) => !id.startsWith("temp_"));
                      if (realIds.length === 0) return;

                      await fetch("/api/owner/videos/bulk", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "DELETE", videoIds: realIds }),
                      });

                      setVideos((prev) => prev.filter((v) => !realIds.includes(v.id)));
                      setSelectedIds([]);
                    }}
                  >
                    Delete
                  </Button>
                </>
              )}

              <button
                type="button"
                title="Archived videos still count toward storage."
                onClick={() => setShowArchived((v) => !v)}
                className={[
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition",
                  showArchived
                    ? "bg-[var(--accent-solid)]/15 text-[var(--accent-solid)] border border-[var(--accent-solid)]/40 hover:bg-[var(--accent-solid)]/25"
                    : "border border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-1)] hover:bg-[var(--surface-2)]",
                ].join(" ")}
              >
                {showArchived ? "Hide Archived" : "Show Archived"}
              </button>
              
              {inflightCount > 0 && (
                <>
                  {inflightStuck && (
                    <button
                      type="button"
                      onClick={() => pollForceRef.current?.()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-xs font-semibold text-[var(--warning)] hover:bg-[var(--warning)]/15"
                      title="Force refresh processing status"
                    >
                      Refresh status
                    </button>
                  )}

                  <div
                    className={[
                      "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold",
                      inflightStuck
                        ? "border-[var(--warning)]/40 bg-[var(--warning)]/10 text-[var(--warning)]"
                        : "border-[var(--border-1)] bg-[var(--surface-1)]/40 text-[var(--text-2)]",
                    ].join(" ")}
                    title={
                      inflightStuck
                        ? "Still processing. If this continues, refresh the page."
                        : "Uploads/transcodes in progress."
                    }
                  >
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current opacity-80" />
                    Processing {inflightCount}
                  </div>
                </>
              )}
              
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-2)]"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>

              <button
                type="button"
                onClick={() => setManageSharesOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-2)]"
              >
                <Link2 className="h-4 w-4" />
                Manage Links
              </button>

              <UploadDropzone.Button
                onFiles={handleFiles}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-solid)] px-3 py-2 text-sm font-semibold text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)]"
              >
                <Upload className="h-4 w-4" />
                Upload Video
              </UploadDropzone.Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <UploadDropzone onFiles={handleFiles} />

        <div className="mt-6">
          {visibleForGrid.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-0)]/40 p-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-lg font-semibold text-[var(--text-1)]">No videos yet</div>
                  <div className="mt-1 text-sm text-[var(--text-muted)]">
                    Drag a video into the drop zone above, or click “Upload Video”.
                  </div>
                </div>

                <UploadDropzone.Button
                  onFiles={handleFiles}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                >
                  <Plus className="h-4 w-4" />
                  Add first video
                </UploadDropzone.Button>
              </div>
            </div>
          ) : (
            <VideoGrid
              videos={visibleForGrid}
              onOpen={handleOpenCard}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              showSelectionUI={showSelectionUI}
              dropTargetId={dropTargetId}
              onDragStartCard={onDragStartCard}
              onDragEndCard={onDragEndCard}
              onDragOverCard={onDragOverCard}
              onDropOnCard={onDropOnCard}
              onMenuAction={(videoId, action) => {
                if (action === "MANAGE_VERSIONS") openManageFor(videoId);
                if (action === "UNSTACK") unstack(videoId);
                if (action === "EDIT_THUMBNAIL") setEditThumbnailVideoId(videoId);
                if (action === "SHARE") setShareVideoId(videoId);
              }}
              isStackCard={(videoId) => {
                const parentId = getParentId(videoId, childToParent);
                return isStackParent(parentId, stacks);
              }}
              onRetryFailed={(videoId) => {
                setRetryForVideoId(videoId);
                setUploadOpen(true);
              }}
            />
          )}
        </div>
      </div>

      <UploadVideoModal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setPendingUpload(null);
          setRetryForVideoId(null);
        }}
        galleryId={galleryId}
        initialFile={pendingUpload?.file ?? null}
        tempId={pendingUpload?.tempId ?? null}
        retryDefaults={retryDefaults}
        onBound={(tempId, videoId) => {
          replaceVideoId(tempId, videoId);
        }}
        onStage={(videoId, stage) => {
          if (stage === "PROCESSING") patchVideo(videoId, { status: "PROCESSING" });
          if (stage === "FAILED") patchVideo(videoId, { status: "FAILED" });
        }}
        onDone={(videoId) => {
          setUploadOpen(false);
          setPendingUpload(null);
          setRetryForVideoId(null);
        }}
        onUploaded={({ videoId, title, description }) => {
          patchVideo(videoId, {
            name: title ?? byIdRef.current.get(videoId)?.name ?? "Untitled",
            description: description ?? "",
            status: "PROCESSING",
          });
        }}
      />

      <ShareGalleryModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        galleryId={galleryId}
        title={gallery.name}
        allowedVideoIds={shareableVideoIds}
        stacks={stacks}
      />

      <ShareModal
        open={Boolean(shareVideoId)}
        onClose={() => setShareVideoId(null)}
        videoId={shareVideoId ?? ""}
      />

      <ManageSharesModal
        open={manageSharesOpen}
        onClose={() => setManageSharesOpen(false)}
        galleryId={galleryId}
        galleryTitle={gallery.name}
      />

      <ManageVersionsModal
        open={manageOpen && !manageParentId}
        onClose={() => setManageOpen(false)}
        videos={selectedVideos}
        onConfirm={(orderedIds) => {
          applyStackOrder(orderedIds);
          setManageOpen(false);
        }}
      />

      <ManageVersionsModal
        open={manageOpen && Boolean(manageParentId)}
        onClose={() => {
          setManageOpen(false);
          setManageParentId(null);
        }}
        videos={manageVideos}
        onConfirm={(orderedIds) => {
          applyStackOrder(orderedIds);
          setManageOpen(false);
          setManageParentId(null);
        }}
      />

      <EditThumbnailModal
        open={Boolean(editThumbnailVideoId)}
        onClose={() => setEditThumbnailVideoId(null)}
        videoId={editThumbnailVideoId}
        currentThumbnailUrl={
          editThumbnailVideoId ? (byId.get(editThumbnailVideoId)?.thumbnailUrl ?? null) : null
        }
        onUpdated={(videoId, thumbnailUrl) => {
          patchVideo(videoId, { thumbnailUrl });
        }}
      />
    </div>
  );
}