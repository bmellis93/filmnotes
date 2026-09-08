"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";

export default function EditGalleryModal({
  open,
  onClose,
  currentName,
  currentDescription,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  currentName: string;
  currentDescription: string;
  onSave: (draft: { name: string; description: string }) => Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(currentName);
    setDescription(currentDescription);
    setError(null);
  }, [open, currentName, currentDescription]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0 && !saving;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), description: description.trim() });
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--border-1)] bg-[var(--surface-0)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-[var(--text-1)]">Edit gallery</div>
            <div className="text-xs text-[var(--text-muted)]">Update the name and description.</div>
          </div>

          <button
            type="button"
            onClick={() => (saving ? null : onClose())}
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
              className="w-full rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--text-1)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--border-3)]"
              placeholder="e.g. Chrissy + Stephen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-3)]">Description</label>
            <textarea
              className="w-full rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--text-1)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--border-3)]"
              placeholder="Optional…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
