"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  uploadVideoToR2,
  resumeVideoUpload,
  fmtGB,
  type StorageLimitError,
  type FingerprintMismatchError,
} from "@/lib/uploadClient";
import { logUploadFailure } from "@/lib/telemetry";

export type ManagedUpload = {
  id: string;
  galleryId: string;
  fileName: string;
  progress: number; // 0-100
  status: "uploading" | "done" | "error";
  error?: string;
  videoId?: string;
};

export type StartUploadArgs = {
  /** Internal map key -- unique per attempt, but not necessarily a real tempId. */
  id: string;
  /** GalleryDetailScreen's optimistic-card id, when there is one -- onBound
   *  and the failure branch of onStage only fire with this, matching the
   *  original modal's guard (`if (tempId) ...`), since a caller with no
   *  tempId has no optimistic card listening for either. */
  tempId?: string | null;
  galleryId: string;
  file: File;
  title?: string;
  description?: string;
  thumbnailFile?: File | null;

  // Mirrors UploadVideoModal's existing callback contract -- the manager
  // fires these itself once the upload settles, whether or not the modal
  // that started it is still mounted (that's the whole point: closing the
  // modal, or navigating elsewhere, no longer cancels anything in flight).
  onBound?: (tempId: string, videoId: string) => void;
  onStage?: (videoId: string, stage: "PROCESSING" | "FAILED") => void;
  onUploaded?: (payload: { videoId: string; title: string; description?: string }) => void;
  onDone?: (videoId: string) => void;
};

export type ResumeUploadArgs = {
  id: string;
  videoId: string;
  galleryId: string;
  file: File;
  onStage?: (videoId: string, stage: "PROCESSING" | "FAILED") => void;
  onUploaded?: (payload: { videoId: string; title: string; description?: string }) => void;
  onDone?: (videoId: string) => void;
};

type UploadManagerContextValue = {
  uploads: ManagedUpload[];
  startUpload: (args: StartUploadArgs) => void;
  resumeUpload: (args: ResumeUploadArgs) => void;
  dismissUpload: (id: string) => void;
};

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<Record<string, ManagedUpload>>({});

  const patch = useCallback((id: string, next: Partial<ManagedUpload>) => {
    setUploads((prev) => {
      const existing = prev[id];
      if (!existing) return prev; // dismissed (or never started) -- ignore stale updates
      return { ...prev, [id]: { ...existing, ...next } };
    });
  }, []);

  const startUpload = useCallback(
    (args: StartUploadArgs) => {
      const { id, tempId, galleryId, file, title, description, thumbnailFile, onBound, onStage, onUploaded, onDone } =
        args;

      setUploads((prev) => ({
        ...prev,
        [id]: { id, galleryId, fileName: file.name, progress: 0, status: "uploading" },
      }));

      uploadVideoToR2({
        galleryId,
        file,
        title,
        description,
        thumbnailFile,
        onProgress: (pct) => patch(id, { progress: pct }),
        onVideoId: (videoId) => patch(id, { videoId }),
      })
        .then(({ videoId }) => {
          patch(id, { progress: 100, status: "done", videoId });
          if (tempId) onBound?.(tempId, videoId);
          onStage?.(videoId, "PROCESSING");
          onUploaded?.({ videoId, title: title || file.name, description });
          onDone?.(videoId);
        })
        .catch((e: unknown) => {
          // Matches the pre-existing tempId-not-videoId behavior here.
          if (tempId) onStage?.(tempId, "FAILED");

          const err = e as StorageLimitError;
          const message =
            err?.code === "STORAGE_LIMIT" && err.payload
              ? `You have ${fmtGB(err.payload.remainingBytes)} GB remaining. This file is ${fmtGB(err.payload.incomingBytes)} GB.`
              : (e as any)?.message || "Upload failed.";

          if (err?.code !== "STORAGE_LIMIT") {
            logUploadFailure({ where: "UPLOAD", videoId: id, reason: (e as any)?.message ?? null });
          }

          patch(id, { status: "error", error: message });
        });
    },
    [patch]
  );

  // Resuming a video whose tab was closed/reloaded mid-upload -- videoId is
  // already known (there's no tempId/onBound step, since the video already
  // exists), so this seeds the map with it from the start rather than
  // waiting on an onVideoId callback the way a fresh upload does.
  const resumeUpload = useCallback(
    (args: ResumeUploadArgs) => {
      const { id, videoId, galleryId, file, onStage, onUploaded, onDone } = args;

      setUploads((prev) => ({
        ...prev,
        [id]: { id, galleryId, fileName: file.name, progress: 0, status: "uploading", videoId },
      }));

      resumeVideoUpload({
        videoId,
        file,
        onProgress: (pct) => patch(id, { progress: pct }),
      })
        .then(() => {
          patch(id, { progress: 100, status: "done" });
          onStage?.(videoId, "PROCESSING");
          onUploaded?.({ videoId, title: file.name });
          onDone?.(videoId);
        })
        .catch((e: unknown) => {
          const err = e as FingerprintMismatchError;
          const message = err?.code === "FINGERPRINT_MISMATCH" ? err.message : (e as any)?.message || "Resume failed.";

          if (err?.code !== "FINGERPRINT_MISMATCH") {
            logUploadFailure({ where: "RESUME", videoId, reason: (e as any)?.message ?? null });
          }

          patch(id, { status: "error", error: message });
        });
    },
    [patch]
  );

  const dismissUpload = useCallback((id: string) => {
    setUploads((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const value = useMemo<UploadManagerContextValue>(
    () => ({ uploads: Object.values(uploads), startUpload, resumeUpload, dismissUpload }),
    [uploads, startUpload, resumeUpload, dismissUpload]
  );

  return <UploadManagerContext.Provider value={value}>{children}</UploadManagerContext.Provider>;
}

export function useUploadManager(): UploadManagerContextValue {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) throw new Error("useUploadManager must be used within UploadManagerProvider");
  return ctx;
}
