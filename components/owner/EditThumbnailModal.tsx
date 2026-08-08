"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { uploadThumbnail } from "@/lib/uploadClient";
import FilePickerButton from "@/components/owner/FilePickerButton";

type Props = {
  open: boolean;
  onClose: () => void;
  videoId: string | null;
  currentThumbnailUrl?: string | null;
  onUpdated?: (videoId: string, thumbnailUrl: string) => void;
};

export default function EditThumbnailModal({
  open,
  onClose,
  videoId,
  currentThumbnailUrl,
  onUpdated,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setError(null);
  }, [open, videoId]);

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

  const displayUrl = previewUrl ?? currentThumbnailUrl ?? null;

  async function handleSave() {
    if (!file || !videoId) return;
    setBusy(true);
    setError(null);

    try {
      const thumbnailUrl = await uploadThumbnail(videoId, file);
      onUpdated?.(videoId, thumbnailUrl);
      setFile(null);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to update thumbnail.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => {
          if (busy) return;
          onClose();
        }}
      />
      <div className="absolute inset-x-0 top-12 mx-auto w-full max-w-md px-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-neutral-900 p-4">
            <div className="text-sm font-semibold">Edit Thumbnail</div>
            <button
              type="button"
              onClick={() => {
                if (busy) return;
                onClose();
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-neutral-300 hover:bg-neutral-900 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
              {displayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayUrl} alt="Thumbnail preview" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-neutral-500">
                  No thumbnail yet
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <FilePickerButton
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={busy}
                label={file ? "Change Image" : "Choose Image"}
                onFile={setFile}
              />
              {file && <span className="text-xs text-neutral-400">{file.name}</span>}
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-neutral-900 p-4">
            <button
              type="button"
              onClick={() => {
                if (busy) return;
                onClose();
              }}
              className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-semibold text-neutral-100 hover:bg-neutral-800"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !file}
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-200 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
