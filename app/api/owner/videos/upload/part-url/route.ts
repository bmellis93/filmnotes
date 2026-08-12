import { NextResponse } from "next/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { prisma } from "@/lib/prisma";
import { r2, getR2Bucket, getR2SignedUrlTtlSeconds } from "@/lib/r2";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const owner = await requireOwnerContext();

  const body = await req.json().catch(() => ({} as any));

  const videoId = String(body.videoId ?? "").trim();
  const uploadId = String(body.uploadId ?? "").trim();
  const partNumber = Number(body.partNumber);

  if (!videoId || !uploadId) {
    return NextResponse.json({ ok: false, error: "Missing videoId or uploadId" }, { status: 400 });
  }
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    return NextResponse.json({ ok: false, error: "Invalid partNumber" }, { status: 400 });
  }

  const video = await prisma.video.findFirst({
    where: { id: videoId, orgId: owner.orgId },
    select: { originalKey: true },
  });

  if (!video?.originalKey) {
    return NextResponse.json({ ok: false, error: "Video not found" }, { status: 404 });
  }

  const cmd = new UploadPartCommand({
    Bucket: getR2Bucket(),
    Key: video.originalKey,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  const url = await getSignedUrl(r2, cmd, { expiresIn: getR2SignedUrlTtlSeconds() });

  return NextResponse.json({ ok: true, url });
}
