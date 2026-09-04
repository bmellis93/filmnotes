"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Share2, Eye } from "lucide-react";
import Button from "@/components/ui/Button";
import StatusPill, { type PillTone } from "@/components/ui/StatusPill";
import FilePickerButton from "@/components/owner/FilePickerButton";

export type GalleryVideo = {
  id: string;
  name: string;
  description: string;
  status: "READY" | "UPLOADED" | "UPLOADING" | "PROCESSING" | "FAILED";
  createdAt: string;
  thumbnailUrl: string | null;
  versionsCount: number;
  archivedAt?: string | null;
  deletedAt?: string | null;
  originalSize?: number | null;
  playbackUrl?: string | null;
  failureReason?: string | null;
  approvalStatus?: "PENDING" | "CHANGES_REQUESTED" | "APPROVED";
  firstViewedAt?: string | null;
  /** Non-null only while status is UPLOADED and the multipart upload is
   *  still open server-side -- lets a stalled (tab closed/reloaded)
   *  upload offer to resume instead of just sitting there forever. */
  uploadId?: string | null;
};

function viewedLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type MenuAction = "MANAGE_VERSIONS" | "UNSTACK" | "EDIT_THUMBNAIL" | "SHARE";

type Props = {
  videos: GalleryVideo[];
  onOpen: (videoId: string) => void;

  // selection
  selectedIds?: string[];
  onToggleSelect?: (videoId: string) => void;
  showSelectionUI?: boolean;

  // drag/drop stacking
  dropTargetId?: string | null;
  onDragStartCard?: (videoId: string) => void;
  onDragEndCard?: () => void;
  onDragOverCard?: (videoId: string) => void;
  onDropOnCard?: (videoId: string) => void;

  // menu actions (for stack cards)
  onMenuAction?: (videoId: string, action: MenuAction) => void;

  // stack awareness
  isStackCard?: (videoId: string) => boolean;

    onRetryFailed?: (videoId: string) => void;

  // Resuming an upload whose tab was closed/reloaded mid-upload (status
  // UPLOADED with a live uploadId, but not one of this tab's own active
  // uploads -- see activeUploadVideoIds).
  activeUploadVideoIds?: Set<string>;
  onResumeStalled?: (videoId: string, file: File) => void;
  onDiscardStalled?: (videoId: string, uploadId: string) => void;

  /** 0-100, keyed by videoId -- only ever populated while status is
   *  UPLOADING (by the time it flips to PROCESSING the upload manager has
   *  already reported 100%), and only for uploads this tab is actively
   *  driving. See UploadManagerContext's ManagedUpload.progress. */
  uploadProgressByVideoId?: Record<string, number>;
};

function statusLabel(status: GalleryVideo["status"]) {
  if (status === "UPLOADING" || status === "UPLOADED") return "Uploading…";
  if (status === "PROCESSING") return "Processing…";
  if (status === "FAILED") return "Failed";
  return "No thumbnail";
}

function approvalPill(status: GalleryVideo["approvalStatus"]): { label: string; tone: PillTone } {
  if (status === "APPROVED") return { label: "Approved", tone: "success" };
  if (status === "CHANGES_REQUESTED") return { label: "Changes requested", tone: "warning" };
  return { label: "Pending review", tone: "neutral" };
}

function statusPill(status: GalleryVideo["status"]): { label: string; tone: PillTone } | null {
  if (status === "UPLOADING") return { label: "Uploading…", tone: "neutral" };
  if (status === "UPLOADED" || status === "PROCESSING") return { label: "Processing…", tone: "neutral" };
  if (status === "FAILED") return { label: "Failed", tone: "danger" };
  return null;
}

export default function VideoGrid({
  videos,
  onOpen,
  selectedIds = [],
  onToggleSelect,
  showSelectionUI = false,

  dropTargetId = null,
  onDragStartCard,
  onDragEndCard,
  onDragOverCard,
  onDropOnCard,

  onMenuAction,
  isStackCard,
  onRetryFailed,

  activeUploadVideoIds,
  onResumeStalled,
  onDiscardStalled,
  uploadProgressByVideoId,
}: Props) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);
  const openMenuRootRef = useRef<HTMLDivElement | null>(null);

  function closeMenu() {
    setMenuOpenForId(null);
  }

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!menuOpenForId) return;
      const root = openMenuRootRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      closeMenu();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!menuOpenForId) return;
      if (e.key === "Escape") closeMenu();
    }

    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpenForId]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => {
        const isSelected = selected.has(v.id);
        const isDropTarget = dropTargetId === v.id;
        const stackCard = isStackCard?.(v.id) ?? false;

        const menuOpen = menuOpenForId === v.id;
        const canDrag = v.status === "READY";

        const isArchived = Boolean(v.archivedAt);

        const isStalledUpload =
          v.status === "UPLOADED" && Boolean(v.uploadId) && !activeUploadVideoIds?.has(v.id);

        const pill = isStalledUpload ? { label: "Interrupted", tone: "warning" as PillTone } : statusPill(v.status);
        const uploadProgress = v.status === "UPLOADING" ? uploadProgressByVideoId?.[v.id] : undefined;

        return (
          <div
            key={v.id}
            draggable={canDrag}
            onDragStart={(e) => {
              if (!canDrag) {
                e.preventDefault();
                return;
              }
              closeMenu();
              onDragStartCard?.(v.id);
            }}
            onDragEnd={() => onDragEndCard?.()}
            onDragOver={(e) => {
              e.preventDefault();
              onDragOverCard?.(v.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDropOnCard?.(v.id);
            }}
            className={[
              "group relative overflow-hidden rounded-2xl border bg-[var(--surface-0)]/40 transition",
              "focus-within:ring-2 focus-within:ring-[var(--accent-solid)]/15",
              isArchived ? "opacity-60" : "",
              canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default",
              isDropTarget
                ? "border-[var(--accent-solid)]/40 ring-2 ring-[var(--accent-solid)]/15 bg-[var(--surface-1)]/25"
                : "border-[var(--border-2)] hover:bg-[var(--surface-1)]/20",
            ].join(" ")}
          >
            {/* Top-right controls */}
            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              {/* checkbox */}
              {onToggleSelect && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeMenu();
                    onToggleSelect(v.id);
                  }}
                  className={[
                    "h-8 w-8 rounded-lg border border-[var(--border-1)] bg-[var(--surface-0)]/60 backdrop-blur",
                    "grid place-items-center transition",
                    showSelectionUI || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    isSelected ? "ring-2 ring-[var(--accent-solid)]/40" : "hover:bg-[var(--surface-1)]",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]/20",
                  ].join(" ")}
                  aria-label={isSelected ? "Deselect video" : "Select video"}
                  aria-pressed={isSelected}
                  title={isSelected ? "Selected" : "Select"}
                >
                  <div
                    className={[
                      "h-4 w-4 rounded border transition",
                      isSelected ? "bg-[var(--accent-solid)] border-[var(--accent-solid)]" : "border-[var(--border-3)]",
                    ].join(" ")}
                  />
                </button>
              )}

              {/* menu (all cards) */}
              <div className="relative" ref={menuOpen ? openMenuRootRef : null}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenForId((prev) => (prev === v.id ? null : v.id));
                  }}
                  className={[
                    "h-8 w-8 rounded-lg border border-[var(--border-1)] bg-[var(--surface-0)]/60 backdrop-blur",
                    "grid place-items-center text-[var(--text-2)] transition hover:bg-[var(--surface-1)]",
                    "opacity-0 group-hover:opacity-100",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]/20",
                  ].join(" ")}
                  aria-label="Video options"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  title="Options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    aria-label="Video options"
                    className="absolute right-0 top-10 w-44 overflow-hidden rounded-xl border border-[var(--border-1)] bg-[var(--surface-0)] shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        closeMenu();
                        onMenuAction?.(v.id, "SHARE");
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-[var(--text-1)] hover:bg-[var(--surface-1)] focus:outline-none focus-visible:bg-[var(--surface-1)]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </span>
                    </button>

                    <div className="h-px bg-[var(--surface-1)]" />

                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        closeMenu();
                        onMenuAction?.(v.id, "EDIT_THUMBNAIL");
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-[var(--text-1)] hover:bg-[var(--surface-1)] focus:outline-none focus-visible:bg-[var(--surface-1)]"
                    >
                      Edit Thumbnail
                    </button>

                    {stackCard && (
                      <>
                        <div className="h-px bg-[var(--surface-1)]" />

                        <button
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            closeMenu();
                            onMenuAction?.(v.id, "MANAGE_VERSIONS");
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-[var(--text-1)] hover:bg-[var(--surface-1)] focus:outline-none focus-visible:bg-[var(--surface-1)]"
                        >
                          Manage Versions
                        </button>

                        <div className="h-px bg-[var(--surface-1)]" />

                        <button
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            closeMenu();
                            onMenuAction?.(v.id, "UNSTACK");
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-[var(--text-1)] hover:bg-[var(--surface-1)] focus:outline-none focus-visible:bg-[var(--surface-1)]"
                        >
                          Unstack
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Card click target */}
            <div
              role="button"
              tabIndex={isArchived ? -1 : 0}
              onClick={() => {
                if (isArchived) return;
                closeMenu();
                onOpen(v.id);
              }}
              onKeyDown={(e) => {
                if (isArchived) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  closeMenu();
                  onOpen(v.id);
                }
              }}
              className="w-full text-left focus:outline-none"
              aria-label={`Open ${v.name}`}
              title={isArchived ? "Archived video" : "Open"}
            >
              {isArchived ? (
                <div className="absolute right-4 top-4 z-10 rounded-full border border-[var(--border-3)] bg-black/40 px-2 py-1 text-[10px] font-semibold text-[var(--text-2)] backdrop-blur">
                  Archived
                </div>
              ) : null}

              {/* thumbnail area */}
              <div className="aspect-video w-full bg-[var(--surface-1)]/60 relative">
                {pill ? (
                  <div className="absolute left-3 top-3 z-10">
                    <StatusPill tone={pill.tone} className="px-2 py-0.5 text-[10px]">
                      {pill.label}
                    </StatusPill>
                  </div>
                ) : null}

                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.thumbnailUrl}
                    alt={v.name ? `${v.name} thumbnail` : "Video thumbnail"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : v.status === "UPLOADING" || v.status === "UPLOADED" || v.status === "PROCESSING" ? (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-br from-[var(--surface-2)]/60 via-[var(--surface-1)]/30 to-[var(--surface-2)]/60" />
                    {!isStalledUpload && (
                      <div className="absolute inset-0 -translate-x-full animate-shimmer -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-xs text-[var(--text-3)]">
                      <span>{isStalledUpload ? "Interrupted" : statusLabel(v.status)}</span>
                      {typeof uploadProgress === "number" && (
                        <div className="w-full max-w-[140px]">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                            <div
                              className="h-full rounded-full bg-[var(--accent-solid)] transition-[width] duration-300 ease-out"
                              style={{ width: `${Math.max(0, Math.min(100, uploadProgress))}%` }}
                            />
                          </div>
                          <div className="mt-1 text-center text-[10px] text-[var(--text-3)]">
                            {Math.round(uploadProgress)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--text-muted)]">
                    {statusLabel(v.status)}
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-black/0" />
                </div>
              </div>

              {/* meta */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--text-1)]">{v.name}</div>
                    <div className="truncate text-sm text-[var(--text-muted)]">{v.description || "—"}</div>
                  </div>

                  {v.versionsCount > 1 && (
                    <div className="shrink-0 rounded-full border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-0.5 text-xs text-[var(--text-2)]">
                      v{v.versionsCount}
                    </div>
                  )}
                </div>

                {v.status === "READY" && !isArchived && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {(() => {
                      const ap = approvalPill(v.approvalStatus);
                      return (
                        <StatusPill tone={ap.tone} className="px-2 py-0.5 text-[11px]">
                          {ap.label}
                        </StatusPill>
                      );
                    })()}

                    {(() => {
                      const label = viewedLabel(v.firstViewedAt);
                      if (!label) return null;
                      return (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]"
                          title="When the client first opened this video"
                        >
                          <Eye className="h-3 w-3" />
                          Viewed {label}
                        </span>
                      );
                    })()}
                  </div>
                )}

                {v.status === "FAILED" && !isArchived && onRetryFailed ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetryFailed(v.id);
                    }}
                  >
                    Retry upload
                  </Button>
                ) : null}

                {v.status === "FAILED" && v.failureReason ? (
                  <div className="mt-2 text-xs text-[var(--danger)]/90 line-clamp-2">
                    {v.failureReason}
                  </div>
                ) : null}

                {v.status === "FAILED" ? (
                  <div className="mt-2 text-[11px] text-[var(--text-3)]/80">
                    Try “Retry upload”. If it fails again, the file may be unsupported.
                  </div>
                ) : null}

                {isStalledUpload && !isArchived ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {onResumeStalled && (
                      <FilePickerButton
                        accept="video/*"
                        label="Resume upload"
                        className="inline-flex items-center rounded-lg bg-[var(--accent-solid)] px-3 py-2 text-sm font-semibold text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)]"
                        onFile={(file) => {
                          if (file) onResumeStalled(v.id, file);
                        }}
                      />
                    )}
                    {onDiscardStalled && v.uploadId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onDiscardStalled(v.id, v.uploadId!)}
                      >
                        Discard
                      </Button>
                    )}
                  </div>
                ) : null}

                {isStalledUpload ? (
                  <div className="mt-2 text-[11px] text-[var(--text-3)]/80">
                    This upload was interrupted (tab closed or reloaded). Pick the same file to
                    resume without re-sending what's already uploaded.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}