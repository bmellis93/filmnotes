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

// A stale/expired embed session (see components/embed/useEmbedSession.ts)
// has no cookie to fall back to, so requireOwnerContext() redirects to
// /login instead of 401ing -- fetch() follows that silently by default and
// hands back the login page's HTML as a normal-looking 200. Parsing that as
// JSON throws a cryptic native error ("The string did not match the
// expected pattern" in Safari) with no indication of what actually went
// wrong. `res.redirected` is set whenever fetch followed one, regardless of
// status code, so check it before ever calling res.json() on a success path.
function assertNotRedirectedToLogin(res: Response) {
  if (res.redirected) {
    throw new Error(
      "Your session expired mid-upload (often from the tab being backgrounded for a while). Refresh the page and try again -- you'll need to re-select the file, but nothing else is lost."
    );
  }
}

// Identifies "the same file" across a resume, whether that's an automatic
// in-session retry or (later) a user re-picking a file after reopening the
// tab -- same default fingerprint scheme the tus resumable-upload protocol
// uses (name+size+lastModified), cheap to compute, no file read required.
export function computeUploadFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

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
      fingerprint: computeUploadFingerprint(file),
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

  assertNotRedirectedToLogin(initRes);
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

  assertNotRedirectedToLogin(res);
  const data = (await res.json()) as { ok: boolean; url: string };
  return data.url;
}

type UploadState = {
  uploadId: string;
  partSize: number;
  totalParts: number;
  fingerprint: string | null;
  uploadedPartNumbers: number[];
};

/**
 * What R2 already has for this in-progress upload, straight from the
 * server's own record (`Video.uploadId` etc.) plus a live `ListPartsCommand`
 * -- used both by the in-session auto-retry loop and by resuming a video
 * whose tab was closed/reloaded mid-upload. Returns null if there's nothing
 * to resume (already completed/aborted, wrong videoId, etc.) or the request
 * itself failed -- callers decide what "nothing to resume" means for them.
 */
async function fetchUploadState(opts: { videoId: string }): Promise<UploadState | null> {
  try {
    const res = await fetch("/api/owner/videos/upload/parts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts),
    });

    if (!res.ok) return null;
    assertNotRedirectedToLogin(res);

    const data = (await res.json().catch(() => null)) as
      | { ok: boolean; uploadId?: string; partSize?: number; totalParts?: number; fingerprint?: string | null; uploadedPartNumbers?: number[] }
      | null;

    if (!data?.ok || !data.uploadId || !data.partSize || !data.totalParts) return null;

    return {
      uploadId: data.uploadId,
      partSize: data.partSize,
      totalParts: data.totalParts,
      fingerprint: data.fingerprint ?? null,
      uploadedPartNumbers: data.uploadedPartNumbers ?? [],
    };
  } catch {
    return null;
  }
}

export type FingerprintMismatchError = Error & { code: "FINGERPRINT_MISMATCH" };
export type NothingToResumeError = Error & { code: "NOTHING_TO_RESUME" };

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

  // No JSON body to parse here, but a redirected-to-login response still
  // looks like a plain success (200) otherwise -- the multipart upload was
  // never actually completed server-side, so this can't be allowed to fall
  // through as if it had been.
  assertNotRedirectedToLogin(res);
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

        // xhr.open() throws synchronously (rejecting this promise, since a
        // throw inside a Promise executor becomes a rejection) if `url`
        // isn't well-formed -- seen in production as Safari's opaque "The
        // string did not match the expected pattern." with zero context on
        // which part or what the URL actually looked like. Surface enough
        // to diagnose it (never the query string -- that's the signature)
        // instead of letting that bare native message reach the user.
        try {
          xhr.open("PUT", url, true);
        } catch (openErr: any) {
          const preview = (() => {
            try {
              const u = new URL(url);
              return `${u.protocol}//${u.host}${u.pathname}`;
            } catch {
              return `<unparseable, length ${String(url).length}>`;
            }
          })();
          reject(
            new Error(
              `Part ${partNumber} attempt ${attempt}: invalid upload URL from server (${preview}) -- ${openErr?.message || openErr}`
            )
          );
          return;
        }

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
  /** Part numbers (1-based) R2 already has -- resumed uploads skip these. */
  skipPartNumbers?: Set<number>;
}) {
  const { videoId, uploadId, file, partSize, totalParts, onProgress, concurrency = 4, skipPartNumbers } = opts;

  const partLoaded = new Array<number>(totalParts).fill(0);

  // Count already-uploaded parts as already-loaded so progress reflects a
  // resume's real starting point instead of dropping back to 0%.
  if (skipPartNumbers?.size) {
    for (const partNumber of skipPartNumbers) {
      const idx = partNumber - 1;
      if (idx < 0 || idx >= totalParts) continue;
      const start = idx * partSize;
      const end = Math.min(start + partSize, file.size);
      partLoaded[idx] = end - start;
    }
  }

  function reportProgress() {
    if (!onProgress) return;
    const loaded = partLoaded.reduce((a, b) => a + b, 0);
    onProgress(Math.min(99, (loaded / file.size) * 100));
  }

  reportProgress();

  let nextIndex = 0;
  let firstError: unknown = null;

  async function worker() {
    while (firstError == null) {
      const idx = nextIndex++;
      if (idx >= totalParts) return;

      const partNumber = idx + 1;
      if (skipPartNumbers?.has(partNumber)) continue;

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

  assertNotRedirectedToLogin(initRes);
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

  assertNotRedirectedToLogin(confirmRes);
  const confirmData = (await confirmRes.json()) as { thumbnailUrl: string };
  return confirmData.thumbnailUrl;
}

/**
 * Uploads every part (skipping any already-landed ones) with in-session
 * auto-retry: a transient failure (network drop, embed session refreshing,
 * an R2 hiccup) re-checks what R2 actually has via the parts endpoint and
 * resumes from there instead of restarting from byte zero, for as long as
 * the tab stays open and the File is still in memory. Only aborts the
 * multipart upload (giving up for good) after several attempts.
 */
async function runResumableMultipartUpload(opts: {
  videoId: string;
  uploadId: string;
  partSize: number;
  totalParts: number;
  file: File;
  onProgress?: (percent: number) => void;
  initialSkipPartNumbers?: Set<number>;
}) {
  const { videoId, uploadId, partSize, totalParts, file, onProgress, initialSkipPartNumbers } = opts;

  const MAX_RESUME_ATTEMPTS = 5;
  let uploadError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RESUME_ATTEMPTS; attempt++) {
    try {
      const skipPartNumbers =
        attempt === 1
          ? initialSkipPartNumbers
          : (await fetchUploadState({ videoId }))?.uploadedPartNumbers.reduce((set, n) => {
              set.add(n);
              return set;
            }, new Set<number>()) ?? undefined;

      await uploadPartsInPool({
        videoId,
        uploadId,
        file,
        partSize,
        totalParts,
        onProgress,
        skipPartNumbers,
      });

      await completeMultipartUpload({ videoId, uploadId });
      uploadError = null;
      break;
    } catch (e) {
      uploadError = e;
      if (attempt < MAX_RESUME_ATTEMPTS) {
        // Brief backoff before checking what's already landed and retrying
        // -- gives a session refresh or a flaky connection a moment to settle.
        await new Promise((resolve) => setTimeout(resolve, Math.min(2000 * attempt, 10_000)));
      }
    }
  }

  if (uploadError) {
    await abortMultipartUpload({ videoId, uploadId });
    throw uploadError;
  }

  onProgress?.(100);
}

async function startTranscode(videoId: string) {
  const transRes = await fetch("/api/owner/videos/transcode", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ videoId }),
  });

  if (!transRes.ok) {
    const data = await transRes.json().catch(() => ({}));
    throw new Error((data as any)?.error || "Transcode start failed");
  }

  assertNotRedirectedToLogin(transRes);
}

export async function uploadVideoToR2(params: {
  galleryId: string;
  file: File;
  title?: string;
  description?: string;
  thumbnailFile?: File | null;
  onProgress?: (percent: number) => void;
  /** Fires as soon as the real videoId exists (right after init succeeds),
   *  well before the upload finishes -- lets a caller (the upload manager)
   *  know which real video a still-running upload belongs to. */
  onVideoId?: (videoId: string) => void;
}): Promise<{ videoId: string }> {
  const { galleryId, file, title, description, thumbnailFile, onProgress, onVideoId } = params;

  const init = await initOwnerUpload({
    galleryId,
    file,
    title: title?.trim() || file.name,
    description: description?.trim() || null,
  });

  onVideoId?.(init.videoId);

  await runResumableMultipartUpload({
    videoId: init.videoId,
    uploadId: init.uploadId,
    partSize: init.partSize,
    totalParts: init.totalParts,
    file,
    onProgress,
  });

  if (thumbnailFile) {
    // Non-fatal: Mux's auto-generated thumbnail is a fine fallback.
    try {
      await uploadThumbnail(init.videoId, thumbnailFile);
    } catch (e) {
      console.error("Custom thumbnail upload failed:", e);
    }
  }

  await startTranscode(init.videoId);

  return { videoId: init.videoId };
}

/**
 * Resumes an upload whose tab was closed/reloaded (or otherwise lost all
 * in-memory state) partway through -- the user re-picks the same file via a
 * normal file input, and this verifies it against the fingerprint captured
 * at init time before continuing only the parts R2 doesn't already have.
 * No thumbnail step: any custom thumbnail file picked in the original
 * session is long gone once the page has reloaded, so this always falls
 * back to Mux's auto-generated one, same as a failed custom-thumbnail
 * upload already does in uploadVideoToR2.
 */
export async function resumeVideoUpload(params: {
  videoId: string;
  file: File;
  onProgress?: (percent: number) => void;
}): Promise<{ videoId: string }> {
  const { videoId, file, onProgress } = params;

  const state = await fetchUploadState({ videoId });
  if (!state) {
    const err = new Error(
      "Nothing to resume -- this upload may have already finished, been discarded, or aged out."
    ) as NothingToResumeError;
    err.code = "NOTHING_TO_RESUME";
    throw err;
  }

  if (state.fingerprint && computeUploadFingerprint(file) !== state.fingerprint) {
    const err = new Error(
      "That doesn't look like the same file (name, size, or last-modified date differs). Pick the original file to resume, or discard this upload and start fresh."
    ) as FingerprintMismatchError;
    err.code = "FINGERPRINT_MISMATCH";
    throw err;
  }

  await runResumableMultipartUpload({
    videoId,
    uploadId: state.uploadId,
    partSize: state.partSize,
    totalParts: state.totalParts,
    file,
    onProgress,
    initialSkipPartNumbers: new Set(state.uploadedPartNumbers),
  });

  await startTranscode(videoId);

  return { videoId };
}

/**
 * Gives up on a stalled/interrupted upload for good -- releases the R2
 * multipart upload and the org's reserved storage quota, and marks the
 * video FAILED (picking up the app's existing "Retry upload" flow, which
 * starts a brand-new upload rather than resuming this one). Unlike the
 * internal best-effort abort used after auto-retry gives up, this is a
 * deliberate user action -- a failure here should be visible, not silent.
 */
export async function discardStalledUpload(opts: { videoId: string; uploadId: string }) {
  const res = await fetch("/api/owner/videos/upload/abort", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to discard upload (${res.status}): ${text}`);
  }

  assertNotRedirectedToLogin(res);
}