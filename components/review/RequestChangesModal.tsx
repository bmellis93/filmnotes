"use client";

import { Send, X } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;

  note: string;
  onNoteChange: (next: string) => void;

  onSubmit: () => void;
  isSubmitting: boolean;

  error?: string | null;
};

export default function RequestChangesModal({
  open,
  onClose,
  note,
  onNoteChange,
  onSubmit,
  isSubmitting,
  error,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

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
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4">
        <div className="relative w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-200"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-4 pt-5">
            <div className="text-sm font-semibold text-neutral-100">Request changes</div>
            <div className="mt-1 text-xs text-neutral-500">
              Let your editor know what needs to change. This posts as a comment so they can
              follow up.
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="mt-3 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-700"
              placeholder="What needs to change?"
              rows={4}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              disabled={isSubmitting}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="truncate text-xs text-neutral-500">
                Tip: Press <span className="text-neutral-300">Ctrl/⌘ + Enter</span> to send.
              </div>

              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting || note.trim().length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-white disabled:opacity-50"
                title="Send (Ctrl/⌘ + Enter)"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
