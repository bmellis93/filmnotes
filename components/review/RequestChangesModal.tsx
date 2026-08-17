"use client";

import { Send, X } from "lucide-react";
import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";

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
        <div className="relative w-full max-w-xl rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)] shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-2)]"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-4 pt-5">
            <div className="text-sm font-semibold text-[var(--text-1)]">Request changes</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Let your editor know what needs to change. This posts as a comment so they can
              follow up.
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="mt-3 w-full resize-none rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-3 text-sm text-[var(--text-1)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--border-3)]"
              placeholder="What needs to change?"
              rows={4}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              disabled={isSubmitting}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="truncate text-xs text-[var(--text-muted)]">
                Tip: Press <span className="text-[var(--text-2)]">Ctrl/⌘ + Enter</span> to send.
              </div>

              <Button
                onClick={onSubmit}
                disabled={isSubmitting || note.trim().length === 0}
                title="Send (Ctrl/⌘ + Enter)"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? "Sending…" : "Send request"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
