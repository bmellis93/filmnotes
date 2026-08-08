import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { prisma } from "@/lib/prisma";
import { r2, getR2PublicBucket, getR2PublicBaseUrl, getR2SignedUrlTtlSeconds } from "@/lib/r2";
import { makeThumbnailKey } from "@/lib/r2Keys";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

function s(x: unknown) {
  return String(x ?? "").trim();
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireOwnerContext();
  const { id } = await params;
  const videoId = String(id || "").trim();

  const video = await prisma.video.findFirst({
    where: { id: videoId, orgId: owner.orgId, deletedAt: null },
    select: { id: true, orgId: true },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "Video not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({} as any));
  const filename = s(body.filename);
  const contentType = s(body.contentType);

  if (!filename) {
    return NextResponse.json({ ok: false, error: "Missing filename" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json({ ok: false, error: "Unsupported image type" }, { status: 400 });
  }

  const key = makeThumbnailKey({ orgId: video.orgId, videoId: video.id, filename });

  const bucket = getR2PublicBucket();
  const expiresIn = getR2SignedUrlTtlSeconds();

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2, cmd, { expiresIn });
  const publicUrl = `${getR2PublicBaseUrl()}/${key}`;

  return NextResponse.json({
    ok: true,
    key,
    uploadUrl,
    publicUrl,
    headers: { "content-type": contentType },
  });
}
