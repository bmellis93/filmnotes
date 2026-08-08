// components/owner/UploadVideoModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { GalleryVideo } from "@/components/owner/VideoGrid";
import { uploadVideoToR2, fmtGB, type StorageLimitError } from "@/lib/uploadClient";
import { useRouter } from "next/navigation";
import { logUploadFailure } from "@/lib/telemetry";
import FilePickerButton from "@/components/owner/FilePickerButton";

type Props = {
  open: boolean;
  onClose: () => void;
  galleryId: string;
  onCreated?: (video: GalleryVideo) => void;

  // ✅ NEW
  initialFile?: File | null;
  tempId: string | null;

  retryDefaults?: { title?: string; description?: string } | null;

  onBound?: (tempId: string, videoId: string) => void;
  onStage?: (videoId: string, stage: "PROCESSING" | "FAILED") => void;
  onDone?: (videoId: string) => void;
  
  onUploaded?: (payload: {
    videoId: string;
    title: string;
    description?: string;
  }) => void;
};

export default function UploadVideoModal({
  open,
  onClose,
  onCreated,
  galleryId,
  initialFile = null,

  tempId,
  retryDefaults,
  onBound,
  onStage,
  onDone,

  onUploaded,
}: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [file, setFile] = useState<File | null>(initialFile);
  const [progress, setProgress] = useState(0);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(initialFile ?? null);
    setThumbFile(null);
    setProgress(0);
    setErrorMsg(null);
  }, [open, initialFile]);

  useEffect(() => {
    if (!thumbFile) {
      setThumbPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(thumbFile);
    setThumbPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbFile]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      const res = await fetch("/api/owner/storage/usage", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { ok: boolean; usedBytes: string; limitBytes: string };
      if (!cancelled && json?.ok) {
        const used = Number(json.usedBytes);
        const limit = Number(json.limitBytes);
        if (Number.isFinite(used) && Number.isFinite(limit)) setUsage({ used, limit });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    // Prefer retry defaults
    if (retryDefaults) {
      setName(retryDefaults.title ?? "");
      setDesc(retryDefaults.description ?? "");

      // ✅ important: retry means user must choose a new file
      setFile(null);

      return;
    }

    // Otherwise default from file name
    if (initialFile) {
      const base = initialFile.name.replace(/\.[^/.]+$/, "");
      setName(base);
      setDesc("");
    }
  }, [open, retryDefaults, initialFile]);

  const incomingBytes = file?.size ?? 0;
  
  const willFit = useMemo(() => {
    if (!usage) return null; // unknown until fetched
    return incomingBytes <= Math.max(0, usage.limit - usage.used);
  }, [usage, incomingBytes]);

  const projectedPct = useMemo(() => {
    if (!usage || usage.limit <= 0) return null;
    return Math.max(0, Math.min(1, (usage.used + incomingBytes) / usage.limit));
  }, [usage, incomingBytes]);
  
  const canCreate = useMemo(() => {
    if (!file) return false;
    if (willFit === false) return false; // block when we *know* it won't fit
    return true;
  }, [file, willFit]);

  const createLabel = useMemo(() => {
    if (busy) return "Creating…";
    if (!file) return "Choose a file";
    if (willFit === false) return "Over limit";
    return "Create";
  }, [busy, willFit, file]);

  const usagePct = useMemo(() => {
    if (!usage?.limit) return 0;
    return Math.max(0, Math.min(1, usage.used / usage.limit));
  }, [usage]);

  const usageLevel = usagePct >= 0.9 ? "high" : usagePct >= 0.8 ? "mid" : "ok";

  const remainingBytes = useMemo(() => {
    if (!usage) return null;
    return Math.max(0, usage.limit - usage.used);
  }, [usage]);
  
  const router = useRouter();
  if (!open) return null;

  async function handleCreate() {
    if (!file) return;
    setBusy(true);
    setProgress(0);

    try {
      const { videoId } = await uploadVideoToR2({
        galleryId,
        file,
        title: name.trim() || file.name,
        description: desc.trim() || undefined,
        thumbnailFile: thumbFile,
        onProgress: (pct) => setProgress(pct),
      });

      // temp -> real id (so the optimistic card becomes the real card)
      if (tempId) onBound?.(tempId, videoId);
      onStage?.(videoId, "PROCESSING");
      onUploaded?.({ videoId, title: name.trim() || file.name, description: desc.trim() || undefined });
      onDone?.(videoId);

      // reset + close
      setName("");
      setDesc("");
      setThumbFile(null);
      setFile(null);
      setProgress(0);
      onClose();
    } catch (e) {
      // mark as failed in the card
      if (tempId) onStage?.(tempId, "FAILED");

      const err = e as StorageLimitError;

      if (err?.code === "STORAGE_LIMIT" && err.payload) {
        const remainingGB = fmtGB(err.payload.remainingBytes);
        const incomingGB = fmtGB(err.payload.incomingBytes);

        setErrorMsg(`You have ${remainingGB} GB remaining. This file is ${incomingGB} GB.`);
        return; // ✅ don't throw
      }

      logUploadFailure({
        where: "UPLOAD",
        videoId: tempId ?? "unknown",
        reason: (e as any)?.message ?? null,
      });

      setErrorMsg((e as any)?.message || "Upload failed.");
      return; // ✅ don't throw
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
          setFile(null);
          onClose();
        }}
      />
      <div className="absolute inset-x-0 top-12 mx-auto w-full max-w-lg px-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-neutral-900 p-4">
            <div className="text-sm font-semibold">Upload Video</div>
            <button
              type="button"
              onClick={() => {
                if (busy) return;
                setFile(null);
                onClose();
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-neutral-300 hover:bg-neutral-900 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
            <div className="text-sm font-semibold">Choose a video</div>
            <div className="mt-2">
              <FilePickerButton
                accept="video/*"
                disabled={busy}
                label={file ? "Change Video File" : "Choose Video File"}
                onFile={setFile}
              />
            </div>
            {file ? (
              <div className="mt-2 text-xs text-neutral-400">
                {file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            ) : (
              <div className="mt-2 text-xs text-neutral-500">
                Pick a file to upload to R2.
              </div>
            )}

            {usage && usageLevel !== "ok" ? (
              <div
                className={[
                  "mt-2 rounded-xl border px-3 py-2 text-xs",
                  usageLevel === "high"
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-200"
                    : "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
                ].join(" ")}
              >
                {usageLevel === "high" ? (
                  <>You’re almost out of storage. This upload may fail if you’re over 100 GB.</>
                ) : (
                  <>You’re getting close to your storage limit.</>
                )}
              </div>
            ) : null}

            {usage && file && remainingBytes != null ? (
              <div
                className={[
                  "mt-2 rounded-xl border px-3 py-2 text-xs",
                  willFit === false
                    ? "border-red-500/30 bg-red-500/10 text-red-200"
                    : projectedPct != null && projectedPct >= 0.9
                      ? "border-orange-500/40 bg-orange-500/10 text-orange-200"
                      : projectedPct != null && projectedPct >= 0.8
                        ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
                        : "border-neutral-800 bg-neutral-900/20 text-neutral-300",
                ].join(" ")}
              >
                {willFit === false ? (
                  <>
                    This file won’t fit. You have <b>{fmtGB(remainingBytes)}</b> GB remaining, and this
                    file is <b>{fmtGB(incomingBytes)}</b> GB.
                  </>
                ) : (
                  <>
                    After this upload:{" "}
                    <b>{fmtGB(usage.used + incomingBytes)}</b> / <b>{fmtGB(usage.limit)}</b> GB
                    {projectedPct != null && projectedPct >= 0.9 ? " (almost full)" : null}
                  </>
                )}
              </div>
            ) : null}
          </div>

            <div>
              <label className="text-xs text-neutral-400">Video name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
                placeholder="Trailer v1"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400">Description</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
                placeholder="Optional notes…"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400">Thumbnail (optional)</label>
              <div className="mt-1 flex items-center gap-3">
                {thumbPreviewUrl ? (
                  <img
                    src={thumbPreviewUrl}
                    alt="Thumbnail preview"
                    className="h-14 w-24 shrink-0 rounded-lg border border-neutral-800 object-cover"
                  />
                ) : null}

                <div className="min-w-0 flex-1">
                  <FilePickerButton
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={busy}
                    label={thumbFile ? "Change Thumbnail" : "Choose Thumbnail"}
                    onFile={setThumbFile}
                  />
                  <div className="mt-1 text-xs text-neutral-500">
                    {thumbFile
                      ? thumbFile.name
                      : "Defaults to an auto-generated frame if you skip this."}
                  </div>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {errorMsg}

                <div className="mt-1 text-[11px] text-red-300/80">
                  Archived videos still count toward storage.
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push("/owner/galleries?archived=1");
                    }}
                    className="inline-flex rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/15"
                  >
                    Review archived items
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push("/owner/storage");
                    }}
                    className="inline-flex rounded-lg border border-white/20 px-2 py-1 text-[11px] text-white hover:bg-white/10"
                  >
                    Manage storage
                  </button>
                </div>
              </div>
            )}
            
            {(busy || progress > 0) && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>Uploading…</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-neutral-900">
                  <div
                    className="h-2 rounded-full bg-white transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-neutral-900 p-4">
            <button
              type="button"
              onClick={() => {
                if (busy) return;
                setFile(null);
                onClose();
              }}
              className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-semibold text-neutral-100 hover:bg-neutral-800"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (busy || !canCreate) return;
                handleCreate();
              }}
              disabled={busy || !canCreate}
              className={[
                "rounded-xl px-3 py-2 text-sm font-semibold transition",
                willFit === false
                  ? "bg-red-500/30 text-red-200 cursor-not-allowed"
                  : "bg-white text-neutral-900 hover:bg-neutral-200",
                "disabled:opacity-60",
              ].join(" ")}
            >
              {createLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}