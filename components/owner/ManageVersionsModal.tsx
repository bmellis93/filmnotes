"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import type { GalleryVideo } from "@/components/owner/VideoGrid";
import Button from "@/components/ui/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  videos: GalleryVideo[]; // selected videos
  onConfirm?: (orderedIds: string[]) => void;
};

function move<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const item = next.splice(from, 1)[0];
  next.splice(to, 0, item);
  return next;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ManageVersionsModal({ open, onClose, videos, onConfirm }: Props) {
  const initial = useMemo(() => videos.map((v) => v.id), [videos]);
  const [order, setOrder] = useState<string[]>(initial);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);

  // a11y / focus
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setOrder(initial);
  }, [initial]);

  // Close on Escape + keep focus inside the dialog
  useEffect(() => {
    if (!open) return;

    // focus close button first
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // basic focus trap on Tab
      if (e.key === "Tab") {
        const root = panelRef.current;
        if (!root) return;

        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-disabled"));

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const byId = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos]);
  const ordered = useMemo(
    () => order.map((id) => byId.get(id)).filter(Boolean) as GalleryVideo[],
    [order, byId]
  );

  const canSave = order.length >= 2;

  const onDragStart = useCallback((id: string) => {
    setDragId(id);
  }, []);

  const onDragOver = useCallback(
    (e: React.DragEvent, overId: string) => {
      if (!dragId) return;
      if (dragId === overId) return;

      e.preventDefault(); // allow drop
      const from = order.indexOf(dragId);
      const to = order.indexOf(overId);
      if (from === -1 || to === -1) return;

      // live reorder for nicer feel
      setOrder((prev) => move(prev, from, to));
    },
    [dragId, order]
  );

  const onDrop = useCallback(() => {
    setDragId(null);
  }, []);

  const bump = useCallback(
    (idx: number, dir: -1 | 1) => {
      setOrder((prev) => {
        const nextIdx = clamp(idx + dir, 0, prev.length - 1);
        if (nextIdx === idx) return prev;
        return move(prev, idx, nextIdx);
      });
    },
    []
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* panel */}
      <div
        className="absolute inset-x-0 top-12 mx-auto w-full max-w-xl px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-versions-title"
          aria-describedby="manage-versions-desc"
          className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)] shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-2)] p-4">
            <div>
              <div id="manage-versions-title" className="text-sm font-semibold">
                Manage Versions
              </div>
              <div id="manage-versions-desc" className="mt-0.5 text-xs text-[var(--text-muted)]">
                Drag to reorder or use the arrows. Top item becomes Version 1.
              </div>
            </div>

            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-2">
            {ordered.map((v, idx) => (
              <div
                key={v.id}
                className={[
                  "flex items-center justify-between gap-3 rounded-xl border border-[var(--border-2)] bg-[var(--surface-0)]/40 p-3",
                  dragId === v.id ? "ring-1 ring-[var(--border-3)]" : "",
                ].join(" ")}
                draggable
                onDragStart={() => onDragStart(v.id)}
                onDragOver={(e) => onDragOver(e, v.id)}
                onDrop={onDrop}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)]"
                    aria-hidden="true"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs text-[var(--text-muted)]">Version {idx + 1}</div>
                    <div className="truncate text-sm font-semibold text-[var(--text-1)]">{v.name}</div>
                    <div className="truncate text-sm text-[var(--text-muted)]">{v.description || "—"}</div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => bump(idx, -1)}
                    disabled={idx === 0}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-40"
                    aria-label={`Move ${v.name} up`}
                    title="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => bump(idx, 1)}
                    disabled={idx === ordered.length - 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-40"
                    aria-label={`Move ${v.name} down`}
                    title="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {ordered.length === 0 && (
              <div className="rounded-xl border border-[var(--border-2)] bg-[var(--surface-0)]/40 p-4 text-sm text-[var(--text-muted)]">
                No videos selected.
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-2)] p-4">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>

            <Button
              onClick={() => {
                if (!canSave) return;
                onConfirm?.(order);
                onClose();
              }}
              disabled={!canSave}
            >
              Save versions
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}