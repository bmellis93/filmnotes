// app/api/owner/videos/upload/init/route.ts
import { NextResponse } from "next/server";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { r2, getR2Bucket } from "@/lib/r2";
import { makeOriginalVideoKey } from "@/lib/r2Keys";
import { computeMultipartPlan } from "@/lib/r2Multipart";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { STORAGE_LIMIT_BYTES, clampNonNegativeBigInt } from "@/lib/storageLimit";

export const runtime = "nodejs";

function s(x: unknown) {
  return String(x ?? "").trim();
}

export async function POST(req: Request) {
  const owner = await requireOwnerContext();
  const orgId = owner.orgId;

  let reserved = false;
  let incoming = BigInt(0);

  try {
    const body = await req.json().catch(() => ({} as any));

    const galleryId = s(body.galleryId);
    const filename = s(body.filename);
    const contentType = s(body.contentType) || "application/octet-stream";
    const title = s(body.title) || "Untitled";
    const description = body.description ? s(body.description) : null;

    const sizeRaw = Number(body.size ?? 0);
    if (!Number.isFinite(sizeRaw) || sizeRaw <= 0) {
      return NextResponse.json({ ok: false, error: "Missing size" }, { status: 400 });
    }

    if (!galleryId) {
      return NextResponse.json({ ok: false, error: "Missing galleryId" }, { status: 400 });
    }
    if (!filename) {
      return NextResponse.json({ ok: false, error: "Missing filename" }, { status: 400 });
    }

    incoming = BigInt(sizeRaw);

    // --- Verify gallery belongs to org + determine sortOrder ---
    const gallery = await prisma.gallery.findFirst({
      where: { id: galleryId, orgId, deletedAt: null },
      select: {
        id: true,
        _count: { select: { videos: true } },
      },
    });

    if (!gallery) {
      return NextResponse.json({ ok: false, error: "Gallery not found" }, { status: 404 });
    }

    const sortOrder = gallery._count.videos;

    // --- STORAGE RESERVE (race-proof) ---
    // Need: storageUsedBytes + incoming <= LIMIT
    const maxAllowed = STORAGE_LIMIT_BYTES - incoming;

    if (maxAllowed < BigInt(0)) {
      // incoming is bigger than limit
      return NextResponse.json(
        {
          ok: false,
          error: "Storage limit exceeded",
          usedBytes: "0",
          incomingBytes: incoming.toString(),
          remainingBytes: STORAGE_LIMIT_BYTES.toString(),
          limitBytes: STORAGE_LIMIT_BYTES.toString(),
        },
        { status: 402 }
      );
    }

    const reserveResult = await prisma.org.updateMany({
      where: {
        id: orgId,
        // only reserve if we are still within limit
        storageUsedBytes: { lte: maxAllowed },
      },
      data: {
        storageUsedBytes: { increment: incoming },
      },
    });

    if (reserveResult.count !== 1) {
      const org = await prisma.org.findUnique({
        where: { id: orgId },
        select: { storageUsedBytes: true },
      });

      const used = BigInt(org?.storageUsedBytes ?? BigInt(0));
      const remaining = clampNonNegativeBigInt(STORAGE_LIMIT_BYTES - used);

      return NextResponse.json(
        {
          ok: false,
          error: "Storage limit exceeded",
          usedBytes: used.toString(),
          incomingBytes: incoming.toString(),
          remainingBytes: remaining.toString(),
          limitBytes: STORAGE_LIMIT_BYTES.toString(),
        },
        { status: 402 } // or 413
      );
    }

    reserved = true;

    // --- Create DB rows + key + signed URL ---
    const video = await prisma.video.create({
      data: {
        orgId,
        title,
        description,
        status: "UPLOADED",
        sourceUrl: "",
        originalName: filename,
        originalMime: contentType,
        originalSize: BigInt(sizeRaw),
      },
      select: { id: true, orgId: true },
    });

    await prisma.galleryVideo.create({
      data: {
        galleryId: gallery.id,
        videoId: video.id,
        sortOrder,
      },
    });

    const originalKey = makeOriginalVideoKey({
      orgId: video.orgId,
      videoId: video.id,
      filename,
    });

    await prisma.video.update({
      where: { id: video.id },
      data: { originalKey },
    });

    const bucket = getR2Bucket();

    // Large files can't complete as a single PUT (R2/S3 caps a non-multipart
    // PUT at 5GiB), so every upload -- regardless of size -- goes through
    // R2's multipart API. The client uploads each part separately and asks
    // us to sign a fresh URL per part, so no single presigned URL has to
    // stay valid for the whole (potentially many-hour) transfer.
    const { partSize, totalParts } = computeMultipartPlan(sizeRaw);

    const created = await r2.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: originalKey,
        ContentType: contentType,
        Metadata: { orgId, videoId: video.id },
      })
    );

    if (!created.UploadId) {
      throw new Error("R2 did not return an upload id");
    }

    return NextResponse.json({
      ok: true,
      videoId: video.id,
      originalKey,
      uploadId: created.UploadId,
      partSize,
      totalParts,
      usedReservationBytes: incoming.toString(),
    });
  } catch (err: any) {
    // rollback reservation if we already reserved but failed later
    if (reserved && incoming > BigInt(0)) {
      try {
        await prisma.org.update({
          where: { id: owner.orgId },
          data: { storageUsedBytes: { decrement: incoming } },
        });
      } catch {}
    }

    return NextResponse.json(
      { ok: false, error: err?.message || "Upload init failed" },
      { status: 500 }
    );
  }
}