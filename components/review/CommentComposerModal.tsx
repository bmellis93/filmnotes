"use client";

import { Send, X, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;

  stampLabel: string; // formatted time like "01:23"

  body: string;
  onBodyChange: (next: string) => void;

  onSubmit: () => void;
  isPosting: boolean;

  error?: string | null;
  initials?: string; // "BE" for now

  hasAnnotation?: boolean;
  onStartDrawing?: () => void;
  onRemoveAnnotation?: () => void;
};

export default function CommentComposerModal({
  open,
  onClose,
  stampLabel,
  body,
  onBodyChange,
  onSubmit,
  isPosting,
  error,
  initials = "BE",
  hasAnnotation = false,
  onStartDrawing,
  onRemoveAnnotation,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  // ESC closes, Cmd/Ctrl+Enter sends (Enter alone = newline)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit();
    }
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onSubmit]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40">
      {/* Backdrop (ONLY over the video area container) */}
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-label="Close comment modal"
      />

      {/* Composer (sits above controls) */}
      <div className="absolute inset-x-0 bottom-24 flex justify-center px-4">
        <div className="relative w-full max-w-xl rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)] shadow-2xl">
          {/* Small X (no stroke, not overlapping content) */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-2)]"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {error && (
            <div className="mx-4 mt-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="flex gap-3 p-4 pt-5">
            {/* Avatar */}
            <div className="shrink-0">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-solid)] text-sm font-semibold text-[var(--accent-solid-fg)]">
                {initials}
              </div>
            </div>

            {/* Composer */}
            <div className="min-w-0 flex-1">
              <textarea
                ref={textareaRef}
                className="w-full resize-none rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-3 text-sm text-[var(--text-1)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--border-3)]"
                placeholder="Enter your comment"
                rows={3}
                value={body}
                onChange={(e) => onBodyChange(e.target.value)}
                disabled={isPosting}
              />

              {onStartDrawing && (
                <div className="mt-2">
                  {hasAnnotation ? (
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-2.5 py-1.5">
                      <Pencil className="h-3.5 w-3.5 shrink-0 text-[var(--cue)]" />
                      <span className="flex-1 text-xs text-[var(--text-2)]">Drawing attached</span>
                      <button
                        type="button"
                        onClick={onStartDrawing}
                        className="text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]"
                      >
                        Redraw
                      </button>
                      <button
                        type="button"
                        onClick={onRemoveAnnotation}
                        className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                        aria-label="Remove drawing"
                        title="Remove drawing"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onStartDrawing}
                      disabled={isPosting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Point at something
                    </button>
                  )}
                </div>
              )}

              {/* Bottom row: time + tip (left) + send icon (right) */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="font-timecode rounded-full border border-[var(--warning)]/30 bg-[var(--warning)]/15 px-3 py-1 text-xs font-semibold text-[var(--warning)]">
                    {stampLabel}
                  </div>

                  <div className="truncate text-xs text-[var(--text-muted)]">
                    Tip: Press{" "}
                    <span className="text-[var(--text-2)]">Ctrl/⌘ + Enter</span> to send.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={isPosting || body.trim().length === 0}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)] disabled:opacity-50"
                  title="Send (Ctrl/⌘ + Enter)"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}