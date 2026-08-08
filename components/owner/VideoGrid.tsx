"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Share2 } from "lucide-react";

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
};

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
};

function statusLabel(status: GalleryVideo["status"]) {
  if (status === "UPLOADING" || status === "UPLOADED") return "Uploading…";
  if (status === "PROCESSING") return "Processing…";
  if (status === "FAILED") return "Failed";
  return "No thumbnail";
}

function statusPill(status: GalleryVideo["status"]) {
  if (status === "UPLOADING") return { label: "Uploading…", cls: "bg-white/10 text-neutral-200 border-white/15" };
  if (status === "UPLOADED" || status === "PROCESSING") return { label: "Processing…", cls: "bg-yellow-500/10 text-yellow-200 border-yellow-500/30" };
  if (status === "FAILED") return { label: "Failed", cls: "bg-red-500/10 text-red-200 border-red-500/30" };
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

        const pill = statusPill(v.status);

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
              "group relative overflow-hidden rounded-2xl border bg-neutral-950/40 transition",
              "focus-within:ring-2 focus-within:ring-white/15",
              isArchived ? "opacity-60" : "",
              canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default",
              isDropTarget
                ? "border-white/40 ring-2 ring-white/15 bg-neutral-900/25"
                : "border-neutral-900 hover:bg-neutral-900/20",
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
                    "h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-950/60 backdrop-blur",
                    "grid place-items-center transition",
                    showSelectionUI || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    isSelected ? "ring-2 ring-white/40" : "hover:bg-neutral-900",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                  ].join(" ")}
                  aria-label={isSelected ? "Deselect video" : "Select video"}
                  aria-pressed={isSelected}
                  title={isSelected ? "Selected" : "Select"}
                >
                  <div
                    className={[
                      "h-4 w-4 rounded border transition",
                      isSelected ? "bg-white border-white" : "border-neutral-400",
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
                    "h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-950/60 backdrop-blur",
                    "grid place-items-center text-neutral-200 transition hover:bg-neutral-900",
                    "opacity-0 group-hover:opacity-100",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
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
                    className="absolute right-0 top-10 w-44 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        closeMenu();
                        onMenuAction?.(v.id, "SHARE");
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-neutral-100 hover:bg-neutral-900 focus:outline-none focus-visible:bg-neutral-900"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </span>
                    </button>

                    <div className="h-px bg-neutral-900" />

                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        closeMenu();
                        onMenuAction?.(v.id, "EDIT_THUMBNAIL");
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-neutral-100 hover:bg-neutral-900 focus:outline-none focus-visible:bg-neutral-900"
                    >
                      Edit Thumbnail
                    </button>

                    {stackCard && (
                      <>
                        <div className="h-px bg-neutral-900" />

                        <button
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            closeMenu();
                            onMenuAction?.(v.id, "MANAGE_VERSIONS");
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-neutral-100 hover:bg-neutral-900 focus:outline-none focus-visible:bg-neutral-900"
                        >
                          Manage Versions
                        </button>

                        <div className="h-px bg-neutral-900" />

                        <button
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            closeMenu();
                            onMenuAction?.(v.id, "UNSTACK");
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-neutral-100 hover:bg-neutral-900 focus:outline-none focus-visible:bg-neutral-900"
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
                <div className="absolute right-4 top-4 z-10 rounded-full border border-neutral-700 bg-black/40 px-2 py-1 text-[10px] font-semibold text-neutral-200 backdrop-blur">
                  Archived
                </div>
              ) : null}

              {/* thumbnail area */}
              <div className="aspect-video w-full bg-neutral-900/60 relative">
                {pill ? (
                  <div className="absolute left-3 top-3 z-10">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pill.cls}`}>
                      {pill.label}
                    </span>
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
                  <div className="absolute inset-0">
                    <div className="h-full w-full animate-pulse bg-gradient-to-br from-neutral-900/60 via-neutral-800/30 to-neutral-900/60" />
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-300">
                      {statusLabel(v.status)}
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
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
                    <div className="truncate text-sm font-semibold text-white">{v.name}</div>
                    <div className="truncate text-sm text-neutral-400">{v.description || "—"}</div>
                  </div>

                  {v.versionsCount > 1 && (
                    <div className="shrink-0 rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-200">
                      v{v.versionsCount}
                    </div>
                  )}
                </div>

                {v.status === "FAILED" && !isArchived && onRetryFailed ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetryFailed(v.id);
                    }}
                    className="mt-3 inline-flex items-center rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs font-semibold text-neutral-100 hover:bg-neutral-800"
                  >
                    Retry upload
                  </button>
                ) : null}
                
                {v.status === "FAILED" && v.failureReason ? (
                  <div className="mt-2 text-xs text-red-200/90 line-clamp-2">
                    {v.failureReason}
                  </div>
                ) : null}

                {v.status === "FAILED" ? (
                  <div className="mt-2 text-[11px] text-neutral-300/80">
                    Try “Retry upload”. If it fails again, the file may be unsupported.
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