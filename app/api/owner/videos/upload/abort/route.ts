import { NextResponse } from "next/server";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { r2, getR2Bucket } from "@/lib/r2";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const owner = await requireOwnerContext();

  const body = await req.json().catch(() => ({} as any));

  const videoId = String(body.videoId ?? "").trim();
  const uploadId = String(body.uploadId ?? "").trim();

  if (!videoId || !uploadId) {
    return NextResponse.json({ ok: false, error: "Missing videoId or uploadId" }, { status: 400 });
  }

  const video = await prisma.video.findFirst({
    where: { id: videoId, orgId: owner.orgId },
    select: { originalKey: true, originalSize: true },
  });

  if (video?.originalKey) {
    try {
      await r2.send(
        new AbortMultipartUploadCommand({
          Bucket: getR2Bucket(),
          Key: video.originalKey,
          UploadId: uploadId,
        })
      );
    } catch {
      // Best-effort -- R2 also garbage-collects abandoned multipart uploads on its own.
    }
  }

  // Release the storage quota reserved at init time.
  if (video?.originalSize) {
    try {
      await prisma.org.update({
        where: { id: owner.orgId },
        data: { storageUsedBytes: { decrement: video.originalSize } },
      });
    } catch {}
  }

  await prisma.video.updateMany({
    where: { id: videoId, orgId: owner.orgId },
    data: { status: "FAILED", failureReason: "Upload failed or was cancelled" },
  });

  return NextResponse.json({ ok: true });
}
