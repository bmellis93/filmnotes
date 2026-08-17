import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { mux } from "@/lib/mux";
import { deleteFromR2, deleteFromR2Public } from "@/lib/r2Delete"; // you’ll add this

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireOwnerContext();
  requireRole(owner, "CONTRIBUTOR");
  const { id } = await params;
  const videoId = String(id || "").trim();

  const video = await prisma.video.findFirst({
    where: { id: videoId, orgId: owner.orgId, deletedAt: null },
    select: {
      id: true,
      orgId: true,
      originalSize: true,
      muxAssetId: true,
      originalKey: true,
      thumbnailKey: true,
      thumbnailIsCustom: true,
    },
  });

  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dec = BigInt(video.originalSize ?? 0);

  // 1️⃣ Delete from Mux
  if (video.muxAssetId) {
    await mux.video.assets.delete(video.muxAssetId);
  }

  // 2️⃣ Delete from R2
  if (video.originalKey) {
    await deleteFromR2(video.originalKey);
  }
  if (video.thumbnailIsCustom && video.thumbnailKey) {
    await deleteFromR2Public(video.thumbnailKey);
  }

  // 3️⃣ Remove DB records
  await prisma.$transaction(async (tx) => {
    await tx.galleryVideo.deleteMany({ where: { videoId } });
    await tx.comment.deleteMany({ where: { videoId } });
    await tx.shareLink.deleteMany({ where: { videoId } });

    await tx.video.update({
      where: { id: videoId },
      data: { deletedAt: new Date(), archivedAt: null, status: "FAILED" },
    });

    if (dec > BigInt(0)) {
      await tx.org.update({
        where: { id: owner.orgId },
        data: { storageUsedBytes: { decrement: dec } },
      });
    }
  });

  return NextResponse.json({ ok: true });
}