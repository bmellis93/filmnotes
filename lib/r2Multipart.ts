// lib/r2Multipart.ts
// Sizing rules shared between the upload/init route (which picks the plan)
// and the client (which needs the same numbers to slice the file).

import "server-only";
import { ListPartsCommand, type S3Client } from "@aws-sdk/client-s3";

// S3/R2 multipart limits: every part but the last must be >= 5 MiB, no part
// may exceed 5 GiB, and an upload may have at most 10,000 parts.
export const R2_MULTIPART_MIN_PART_SIZE = 5 * 1024 * 1024;
export const R2_MULTIPART_MAX_PART_SIZE = 5 * 1024 * 1024 * 1024;
export const R2_MULTIPART_MAX_PARTS = 10000;

const DEFAULT_PART_SIZE = 100 * 1024 * 1024; // 100 MiB

export function computeMultipartPlan(fileSize: number) {
  let partSize = DEFAULT_PART_SIZE;

  // Scale up if the default part size would need more than the max part count.
  if (Math.ceil(fileSize / partSize) > R2_MULTIPART_MAX_PARTS) {
    partSize = Math.ceil(fileSize / R2_MULTIPART_MAX_PARTS);
  }

  partSize = Math.min(
    R2_MULTIPART_MAX_PART_SIZE,
    Math.max(R2_MULTIPART_MIN_PART_SIZE, partSize)
  );

  const totalParts = Math.max(1, Math.ceil(fileSize / partSize));

  return { partSize, totalParts };
}

export function partRange(partNumber: number, partSize: number, fileSize: number) {
  const start = (partNumber - 1) * partSize;
  const end = Math.min(start + partSize, fileSize);
  return { start, end };
}

/**
 * Asks R2 which parts of a multipart upload it actually received, rather
 * than trusting any client-side bookkeeping -- the same approach the
 * complete route used on its own before this was extracted, now also used
 * to support resuming an interrupted upload (skip parts R2 already has).
 */
export async function listAllParts(
  r2: S3Client,
  bucket: string,
  key: string,
  uploadId: string
): Promise<{ partNumber: number; size: number; etag: string }[]> {
  const parts: { partNumber: number; size: number; etag: string }[] = [];
  let partNumberMarker: string | undefined;

  do {
    const page = await r2.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: partNumberMarker,
      })
    );

    for (const p of page.Parts ?? []) {
      if (p.PartNumber != null && p.ETag) {
        parts.push({ partNumber: p.PartNumber, size: p.Size ?? 0, etag: p.ETag });
      }
    }

    partNumberMarker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
  } while (partNumberMarker);

  parts.sort((a, b) => a.partNumber - b.partNumber);
  return parts;
}
