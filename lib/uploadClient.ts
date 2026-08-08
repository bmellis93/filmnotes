// lib/uploadClient.ts

type UploadInit = {
  ok: boolean;
  videoId: string;
  originalKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresIn: number;

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

async function uploadThumbnail(videoId: string, thumbnailFile: File) {
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

  await putWithProgress({
    url: init.uploadUrl,
    headers: init.headers ?? {},
    file,
    onProgress,
  });

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