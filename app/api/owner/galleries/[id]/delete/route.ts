// app/api/owner/galleries/[id]/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { mux } from "@/lib/mux";
import { deleteFromR2, deleteFromR2Public } from "@/lib/r2Delete";

export const runtime = "nodejs";

async function safeMuxDelete(muxAssetId: string | null) {
  if (!muxAssetId) return;
  try {
    await mux.video.assets.delete(muxAssetId);
  } catch {}
}

async function safeR2Delete(originalKey: string | null) {
  if (!originalKey) return;
  try {
    await deleteFromR2(originalKey);
  } catch {}
}

async function safeR2PublicDelete(thumbnailKey: string | null) {
  if (!thumbnailKey) return;
  try {
    await deleteFromR2Public(thumbnailKey);
  } catch {}
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireOwnerContext();
  const { id } = await params;
  const galleryId = String(id || "").trim();

  if (!galleryId) {
    return NextResponse.json({ error: "Missing gallery id" }, { status: 400 });
  }

  const gallery = await prisma.gallery.findFirst({
    where: { id: galleryId, orgId: owner.orgId, deletedAt: null },
    select: {
      id: true,
      videos: {
        select: {
          video: {
            select: {
              id: true,
              muxAssetId: true,
              originalKey: true,
              originalSize: true,
              thumbnailKey: true,
              thumbnailIsCustom: true,
            },
          },
        },
      },
    },
  });

  if (!gallery) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  // compute decrement once
  let totalDec = BigInt(0);
  for (const gv of gallery.videos) {
    totalDec += BigInt(gv.video.originalSize ?? 0);
  }

  // 1) External cleanup (best effort)
  for (const gv of gallery.videos) {
    await safeMuxDelete(gv.video.muxAssetId);
    await safeR2Delete(gv.video.originalKey);
    if (gv.video.thumbnailIsCustom) await safeR2PublicDelete(gv.video.thumbnailKey);
  }

  const now = new Date();

  // 2) Soft-delete + decrement inside one transaction
  await prisma.$transaction(async (tx) => {
    await tx.shareLink.deleteMany({
      where: { OR: [{ galleryId }, { videoId: { in: gallery.videos.map((x) => x.video.id) } }] },
    });

    await tx.comment.deleteMany({
      where: { videoId: { in: gallery.videos.map((x) => x.video.id) } },
    });

    await tx.video.updateMany({
      where: {
        deletedAt: null,
        galleryVideos: { some: { galleryId } },
      },
      data: { deletedAt: now, archivedAt: null },
    });

    await tx.gallery.update({
      where: { id: galleryId },
      data: { deletedAt: now, archivedAt: null },
    });

    await tx.galleryVideo.deleteMany({ where: { galleryId } });

    if (totalDec > BigInt(0)) {
      await tx.org.update({
        where: { id: owner.orgId },
        data: { storageUsedBytes: { decrement: totalDec } },
      });
    }
  });

  return NextResponse.json({ ok: true });
}