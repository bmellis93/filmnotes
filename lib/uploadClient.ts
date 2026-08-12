// lib/uploadClient.ts

type UploadInit = {
  ok: boolean;
  videoId: string;
  originalKey: string;
  uploadId: string;
  partSize: number;
  totalParts: number;

  // only present on limit errors
  error?: string;
  usedBytes?: string | number;
  limitBytes?: string | number;
  remainingBytes?: string | number;
  incomingBytes?: string | number;
};

type LimitPayload = {
  ok?: boolean;
  error?: string;
  usedBytes?: string | number;
  limitBytes?: string | number;
  remainingBytes?: string | number;
  incomingBytes?: string | number;
};

export type StorageLimitError = Error & {
  code?: "STORAGE_LIMIT";
  payload?: {
    remainingBytes: number;
    incomingBytes: number;
    usedBytes: number;
    limitBytes: number;
  };
};

function toNum(x: unknown) {
  if (typeof x === "number") return Number.isFinite(x) ? x : 0;
  if (typeof x === "string") {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function fmtGB(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 10 ? gb.toFixed(0) : gb.toFixed(1);
}

function putWithProgress(opts: {
  url: string;
  headers: Record<string, string>;
  file: File;
  onProgress?: (pct: number) => void;
}) {
  const { url, headers, file, onProgress } = opts;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);

    for (const [k, v] of Object.entries(headers || {})) {
      xhr.setRequestHeader(k, v);
    }

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = (e.loaded / e.total) * 100;
      onProgress?.(pct);
    };

    xhr.onerror = () => reject(new Error("R2 upload failed (network error)"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 PUT failed (${xhr.status})`));
    };

    xhr.send(file);
  });
}

export async function initOwnerUpload(opts: {
  galleryId: string;
  file: File;
  title: string;
  description?: string | null;
}): Promise<UploadInit> {
  const { galleryId, file, title, description } = opts;

  const initRes = await fetch("/api/owner/videos/upload/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      galleryId,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      title,
      description,
    }),
  });

  // ✅ handle storage limit exceeded
  if (initRes.status === 402 || initRes.status === 413) {
    const data = (await initRes.json().catch(() => null)) as LimitPayload | null;

    const remainingBytes = toNum(data?.remainingBytes);
    const incomingBytes = toNum(data?.incomingBytes) || file.size;
    const usedBytes = toNum(data?.usedBytes);
    const limitBytes = toNum(data?.limitBytes);

    const err = new Error(data?.error || "Storage limit exceeded") as StorageLimitError;

    err.code = "STORAGE_LIMIT";
    err.payload = { remainingBytes, incomingBytes, usedBytes, limitBytes };

    throw err;
  }

  if (!initRes.ok) {
    const text = await initRes.text().catch(() => "");
    throw new Error(`Upload init failed (${initRes.status}): ${text}`);
  }

  const data = (await initRes.json()) as UploadInit;
  return data;
}

async function getPartUploadUrl(opts: {
  videoId: string;
  uploadId: string;
  partNumber: number;
}): Promise<string> {
  const res = await fetch("/api/owner/videos/upload/part-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to sign part ${opts.partNumber} (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { ok: boolean; url: string };
  return data.url;
}

async function completeMultipartUpload(opts: { videoId: string; uploadId: string }) {
  const res = await fetch("/api/owner/videos/upload/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to complete upload (${res.status}): ${text}`);
  }
}

async function abortMultipartUpload(opts: { videoId: string; uploadId: string }) {
  try {
    await fetch("/api/owner/videos/upload/abort", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts),
    });
  } catch {
    // best-effort cleanup -- the original error is what matters to the caller
  }
}

// One part, with a few retries. Each attempt gets a fresh presigned URL
// (rather than reusing one across retries) so a part that failed because its
// URL expired mid-transfer doesn't just fail the same way again.
async function uploadPartWithRetry(opts: {
  videoId: string;
  uploadId: string;
  partNumber: number;
  blob: Blob;
  onLoaded: (loaded: number) => void;
  maxAttempts?: number;
}) {
  const { videoId, uploadId, partNumber, blob, onLoaded, maxAttempts = 3 } = opts;

  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const url = await getPartUploadUrl({ videoId, uploadId, partNumber });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url, true);

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          onLoaded(e.loaded);
        };

        xhr.onerror = () => reject(new Error("Part upload failed (network error)"));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Part upload failed (${xhr.status})`));
        };

        xhr.send(blob);
      });

      onLoaded(blob.size);
      return;
    } catch (e) {
      lastErr = e;
      onLoaded(0); // this attempt's partial progress didn't count -- reset before retrying
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(`Part ${partNumber} upload failed`);
}

// Uploads every part of the file with a small worker pool, reporting combined
// progress across all parts (capped below 100 until the server confirms the
// multipart upload actually completed).
async function uploadPartsInPool(opts: {
  videoId: string;
  uploadId: string;
  file: File;
  partSize: number;
  totalParts: number;
  onProgress?: (pct: number) => void;
  concurrency?: number;
}) {
  const { videoId, uploadId, file, partSize, totalParts, onProgress, concurrency = 4 } = opts;

  const partLoaded = new Array<number>(totalParts).fill(0);

  function reportProgress() {
    if (!onProgress) return;
    const loaded = partLoaded.reduce((a, b) => a + b, 0);
    onProgress(Math.min(99, (loaded / file.size) * 100));
  }

  let nextIndex = 0;
  let firstError: unknown = null;

  async function worker() {
    while (firstError == null) {
      const idx = nextIndex++;
      if (idx >= totalParts) return;

      const partNumber = idx + 1;
      const start = idx * partSize;
      const end = Math.min(start + partSize, file.size);
      const blob = file.slice(start, end);

      try {
        await uploadPartWithRetry({
          videoId,
          uploadId,
          partNumber,
          blob,
          onLoaded: (loaded) => {
            partLoaded[idx] = loaded;
            reportProgress();
          },
        });
      } catch (e) {
        firstError = e;
        return;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, totalParts) }, () => worker());
  await Promise.all(workers);

  if (firstError) throw firstError;
}

export async function uploadThumbnail(videoId: string, thumbnailFile: File) {
  const initRes = await fetch(`/api/owner/videos/${videoId}/thumbnail/init`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: thumbnailFile.name,
      contentType: thumbnailFile.type,
    }),
  });

  if (!initRes.ok) {
    const text = await initRes.text().catch(() => "");
    throw new Error(`Thumbnail init failed (${initRes.status}): ${text}`);
  }

  const init = (await initRes.json()) as {
    key: string;
    uploadUrl: string;
    headers: Record<string, string>;
  };

  await putWithProgress({
    url: init.uploadUrl,
    headers: init.headers ?? {},
    file: thumbnailFile,
  });

  const confirmRes = await fetch(`/api/owner/videos/${videoId}/thumbnail/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: init.key }),
  });

  if (!confirmRes.ok) {
    const text = await confirmRes.text().catch(() => "");
    throw new Error(`Thumbnail confirm failed (${confirmRes.status}): ${text}`);
  }

  const confirmData = (await confirmRes.json()) as { thumbnailUrl: string };
  return confirmData.thumbnailUrl;
}

export async function uploadVideoToR2(params: {
  galleryId: string;
  file: File;
  title?: string;
  description?: string;
  thumbnailFile?: File | null;
  onProgress?: (percent: number) => void;
}): Promise<{ videoId: string }> {
  const { galleryId, file, title, description, thumbnailFile, onProgress } = params;

  const init = await initOwnerUpload({
    galleryId,
    file,
    title: title?.trim() || file.name,
    description: description?.trim() || null,
  });

  const { videoId, uploadId, partSize, totalParts } = init;

  try {
    await uploadPartsInPool({
      videoId,
      uploadId,
      file,
      partSize,
      totalParts,
      onProgress,
    });

    await completeMultipartUpload({ videoId, uploadId });
  } catch (e) {
    await abortMultipartUpload({ videoId, uploadId });
    throw e;
  }

  onProgress?.(100);

  if (thumbnailFile) {
    // Non-fatal: Mux's auto-generated thumbnail is a fine fallback.
    try {
      await uploadThumbnail(init.videoId, thumbnailFile);
    } catch (e) {
      console.error("Custom thumbnail upload failed:", e);
    }
  }

  const transRes = await fetch("/api/owner/videos/transcode", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ videoId: init.videoId }),
  });

  if (!transRes.ok) {
    const data = await transRes.json().catch(() => ({}));
    throw new Error((data as any)?.error || "Transcode start failed");
  }

  // ✅ the important change:
  return { videoId: init.videoId };
}