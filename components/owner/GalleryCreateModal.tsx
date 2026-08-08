"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type GalleryDraft = {
  name: string;
  description: string;
};

export default function GalleryCreateModal({
  open,
  onClose,
  onCreate,
  onCreateAndOpen,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: GalleryDraft) => void;
  onCreateAndOpen: (draft: GalleryDraft) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
  }, [open]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--border-1)] bg-[var(--surface-0)] shadow-2xl transition will-change-transform hover:-translate-y-0.5 hover:border-[var(--border-3)] hover:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] focus-within:border-[var(--border-3)]">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-[var(--text-1)]">Create gallery</div>
            <div className="text-xs text-[var(--text-muted)]">Add a name and optional description.</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-[var(--text-3)] transition hover:bg-[var(--surface-1)] hover:text-[var(--text-1)] active:scale-[0.98]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-3)]">Gallery name</label>
            <input
              className="w-full rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--text-1)] placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[var(--border-3)]"
              placeholder="e.g. Chrissy + Stephen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-3)]">Description</label>
            <textarea
              className="w-full rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--text-1)] placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[var(--border-3)]"
              placeholder="Optional…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onCreate({ name: name.trim(), description: description.trim() })}
              disabled={!canSubmit}
              className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-2.5 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--surface-1)]"
            >
              Create
            </button>

            <button
              type="button"
              onClick={() => onCreateAndOpen({ name: name.trim(), description: description.trim() })}
              disabled={!canSubmit}
              className="rounded-2xl bg-[var(--accent-solid)] px-4 py-2.5 text-xs font-semibold text-[var(--accent-solid-fg)] transition hover:bg-[var(--accent-solid-hover)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--accent-solid)]"
            >
              Create &amp; open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}