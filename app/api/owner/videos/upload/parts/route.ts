import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { r2, getR2Bucket } from "@/lib/r2";
import { listAllParts } from "@/lib/r2Multipart";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

/**
 * Lets the client (lib/uploadClient.ts's resume-on-failure loop, or a
 * reopened tab resuming a stalled upload) find out which parts of an
 * in-progress multipart upload R2 already has, so it only has to send what's
 * actually missing instead of restarting from byte zero.
 */
export async function POST(req: Request) {
  const owner = await requireOwnerContext();
  requireRole(owner, "UPLOADER");

  const body = await req.json().catch(() => ({} as any));
  const videoId = String(body.videoId ?? "").trim();

  if (!videoId) {
    return NextResponse.json({ ok: false, error: "Missing videoId" }, { status: 400 });
  }

  const video = await prisma.video.findFirst({
    where: { id: videoId, orgId: owner.orgId },
    select: {
      originalKey: true,
      uploadId: true,
      uploadPartSize: true,
      uploadTotalParts: true,
      uploadFingerprint: true,
    },
  });

  if (!video?.originalKey || !video.uploadId) {
    return NextResponse.json({ ok: false, error: "No in-progress upload for this video" }, { status: 404 });
  }

  const parts = await listAllParts(r2, getR2Bucket(), video.originalKey, video.uploadId);

  return NextResponse.json({
    ok: true,
    uploadId: video.uploadId,
    partSize: video.uploadPartSize,
    totalParts: video.uploadTotalParts,
    fingerprint: video.uploadFingerprint,
    uploadedPartNumbers: parts.map((p) => p.partNumber),
  });
}
