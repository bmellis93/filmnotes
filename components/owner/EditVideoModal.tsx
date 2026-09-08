"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import { uploadThumbnail } from "@/lib/uploadClient";
import FilePickerButton from "@/components/owner/FilePickerButton";

export type VideoDetailsPatch = {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  videoId: string | null;
  currentTitle: string;
  currentDescription: string;
  currentThumbnailUrl?: string | null;
  onUpdated?: (videoId: string, patch: VideoDetailsPatch) => void;
};

export default function EditVideoModal({
  open,
  onClose,
  videoId,
  currentTitle,
  currentDescription,
  currentThumbnailUrl,
  onUpdated,
}: Props) {
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(currentTitle);
    setDescription(currentDescription);
    setFile(null);
    setError(null);
  }, [open, videoId, currentTitle, currentDescription]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open || !videoId) return null;

  const displayThumbUrl = previewUrl ?? currentThumbnailUrl ?? null;
  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && !saving;

  async function handleSave() {
    if (!videoId) return;
    setSaving(true);
    setError(null);

    try {
      const patch: VideoDetailsPatch = {};

      const detailsChanged =
        trimmedTitle !== currentTitle || description.trim() !== currentDescription;

      if (detailsChanged) {
        const res = await fetch(`/api/owner/videos/${videoId}/update-details`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmedTitle, description: description.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          title?: string;
          description?: string;
          error?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed to save title/description.");
        patch.title = data.title;
        patch.description = data.description;
      }

      if (file) {
        const thumbnailUrl = await uploadThumbnail(videoId, file);
        patch.thumbnailUrl = thumbnailUrl;
      }

      onUpdated?.(videoId, patch);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => {
          if (saving) return;
          onClose();
        }}
      />
      <div className="absolute inset-x-0 top-12 mx-auto w-full max-w-lg px-4">
        <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border-2)] p-4">
            <div className="text-sm font-semibold">Edit video</div>
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                onClose();
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/60">
              {displayThumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayThumbUrl} alt="Thumbnail preview" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-[var(--text-muted)]">
                  No thumbnail yet
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <FilePickerButton
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={saving}
                label={file ? "Change Image" : "Choose Image"}
                onFile={setFile}
              />
              {file && <span className="text-xs text-[var(--text-muted)]">{file.name}</span>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-3)]">Title</label>
              <input
                className="w-full rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-2.5 text-sm text-[var(--text-1)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--border-3)]"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-3)]">Description</label>
              <textarea
                className="w-full rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-2.5 text-sm text-[var(--text-1)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--border-3)]"
                placeholder="Optional…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={saving}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-2)] p-4">
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                onClose();
              }}
              className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-2)]"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSubmit}
              className="rounded-xl bg-[var(--accent-solid)] px-3 py-2 text-sm font-semibold text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
