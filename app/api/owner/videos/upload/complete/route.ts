import { NextResponse } from "next/server";
import { CompleteMultipartUploadCommand, ListPartsCommand } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { r2, getR2Bucket } from "@/lib/r2";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const owner = await requireOwnerContext();
  requireRole(owner, "UPLOADER");

  const body = await req.json().catch(() => ({} as any));

  const videoId = String(body.videoId ?? "").trim();
  const uploadId = String(body.uploadId ?? "").trim();

  if (!videoId || !uploadId) {
    return NextResponse.json({ ok: false, error: "Missing videoId or uploadId" }, { status: 400 });
  }

  const video = await prisma.video.findFirst({
    where: { id: videoId, orgId: owner.orgId },
    select: { originalKey: true },
  });

  if (!video?.originalKey) {
    return NextResponse.json({ ok: false, error: "Video not found" }, { status: 404 });
  }

  const bucket = getR2Bucket();

  // Ask R2 which parts it actually received rather than trusting the client's
  // own bookkeeping -- also sidesteps needing the bucket's CORS policy to
  // expose the ETag response header to browser JS on every part PUT.
  const parts: { PartNumber: number; ETag: string }[] = [];
  let partNumberMarker: string | undefined;

  do {
    const page = await r2.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: video.originalKey,
        UploadId: uploadId,
        PartNumberMarker: partNumberMarker,
      })
    );

    for (const p of page.Parts ?? []) {
      if (p.PartNumber != null && p.ETag) {
        parts.push({ PartNumber: p.PartNumber, ETag: p.ETag });
      }
    }

    partNumberMarker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
  } while (partNumberMarker);

  if (parts.length === 0) {
    return NextResponse.json({ ok: false, error: "No parts received" }, { status: 400 });
  }

  parts.sort((a, b) => a.PartNumber - b.PartNumber);

  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: video.originalKey,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  );

  return NextResponse.json({ ok: true });
}
