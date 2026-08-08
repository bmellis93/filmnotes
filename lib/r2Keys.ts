// lib/r2Keys.ts
import crypto from "crypto";

export function makeOriginalVideoKey(params: {
  orgId: string;
  videoId: string;
  filename?: string | null;
}) {
  const safeName = (params.filename || "upload")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  const rand = crypto.randomBytes(8).toString("hex");
  // Keep it deterministic-ish + debuggable:
  // originals/<orgId>/<videoId>/<rand>-<filename>
  return `originals/${params.orgId}/${params.videoId}/${rand}-${safeName}`;
}

export function makeThumbnailKey(params: {
  orgId: string;
  videoId: string;
  filename?: string | null;
}) {
  const safeName = (params.filename || "thumbnail")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  const rand = crypto.randomBytes(8).toString("hex");
  // thumbnails/<orgId>/<videoId>/<rand>-<filename>
  return `thumbnails/${params.orgId}/${params.videoId}/${rand}-${safeName}`;
}