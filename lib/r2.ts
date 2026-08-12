// lib/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

function mustGet(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function getR2Bucket() {
  return R2_BUCKET;
}

export function getR2PublicBucket() {
  return mustGet("R2_PUBLIC_BUCKET");
}

export function getR2PublicBaseUrl() {
  return mustGet("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
}

export function getR2SignedUrlTtlSeconds() {
  const raw = process.env.R2_SIGNED_URL_TTL || "3600";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 3600;
}

export const R2_BUCKET = mustGet("R2_BUCKET");

export const r2 = new S3Client({
  region: "auto",
  endpoint: mustGet("R2_ENDPOINT"),
  credentials: {
    accessKeyId: mustGet("R2_ACCESS_KEY_ID"),
    secretAccessKey: mustGet("R2_SECRET_ACCESS_KEY"),
  },
});