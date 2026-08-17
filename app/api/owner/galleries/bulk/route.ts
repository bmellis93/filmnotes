// app/api/owner/galleries/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { mux } from "@/lib/mux";
import { deleteFromR2, deleteFromR2Public } from "@/lib/r2Delete";

type Body =
  | { action: "ARCHIVE" | "UNARCHIVE"; galleryIds: string[] }
  | { action: "DELETE"; galleryIds: string[] };

export const runtime = "nodejs";

async function safeMuxDelete(muxAssetId: string | null) {
  if (!muxAssetId) return;
  try {
    await mux.video.assets.delete(muxAssetId);
  } catch (e) {
    console.error("Mux delete failed:", muxAssetId, e);
  }
}

async function safeR2Delete(originalKey: string | null) {
  if (!originalKey) return;
  try {
    await deleteFromR2(originalKey);
  } catch (e) {
    console.error("R2 delete failed:", originalKey, e);
  }
}

async function safeR2PublicDelete(thumbnailKey: string | null) {
  if (!thumbnailKey) return;
  try {
    await deleteFromR2Public(thumbnailKey);
  } catch (e) {
    console.error("R2 public delete failed:", thumbnailKey, e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = await requireOwnerContext();
    requireRole(owner, "CONTRIBUTOR");
    const body = (await req.json().catch(() => null)) as Body | null;

    const action = body?.action;
    const galleryIds = Array.isArray(body?.galleryIds) ? body!.galleryIds.map(String) : [];

    if (!action || galleryIds.length === 0) {
      return NextResponse.json({ error: "Missing action or galleryIds" }, { status: 400 });
    }

    const galleries = await prisma.gallery.findMany({
      where: { id: { in: galleryIds }, orgId: owner.orgId, deletedAt: null },
      select: {
        id: true,
        videos: {
          select: {
            video: {
              select: {
                id: true,
                muxAssetId: true,
                originalKey: true,
                originalSize: true, // ✅ add
                thumbnailKey: true,
                thumbnailIsCustom: true,
              },
            },
          },
        },
      },
    });

    const ids = galleries.map((g) => g.id);
    if (ids.length === 0) {
      return NextResponse.json({ error: "No matching galleries found" }, { status: 404 });
    }

    const now = new Date();

    if (action === "ARCHIVE" || action === "UNARCHIVE") {
      await prisma.gallery.updateMany({
        where: { id: { in: ids }, orgId: owner.orgId, deletedAt: null },
        data: { archivedAt: action === "ARCHIVE" ? now : null },
      });
      return NextResponse.json({ ok: true });
    }

    // DELETE gallery: delete all videos in these galleries from Mux + R2 (best effort)
    for (const g of galleries) {
      for (const gv of g.videos) {
        const v = gv.video;
        await safeMuxDelete(v.muxAssetId);
        await safeR2Delete(v.originalKey);
        if (v.thumbnailIsCustom) await safeR2PublicDelete(v.thumbnailKey);
      }
    }

    // Dedup videos + compute total storage decrement
    const videoIdSet = new Set<string>();
    let totalDec = BigInt(0);

    for (const g of galleries) {
      for (const gv of g.videos) {
        const v = gv.video;
        if (videoIdSet.has(v.id)) continue;

        videoIdSet.add(v.id);
        totalDec += BigInt(v.originalSize ?? 0);
      }
    }

    const videoIds = Array.from(videoIdSet);

    await prisma.$transaction(async (tx) => {
      // kill shares for gallery + its videos
      await tx.shareLink.deleteMany({
        where: { OR: [{ galleryId: { in: ids } }, { videoId: { in: videoIds } }] },
      });

      // optional cleanup
      await tx.comment.deleteMany({ where: { videoId: { in: videoIds } } });

      // soft-delete videos that belong to these galleries
      await tx.video.updateMany({
        where: {
          deletedAt: null,
          galleryVideos: { some: { galleryId: { in: ids } } },
        },
        data: { deletedAt: now, archivedAt: null },
      });

      // soft-delete galleries
      await tx.gallery.updateMany({
        where: { id: { in: ids }, orgId: owner.orgId },
        data: { deletedAt: now, archivedAt: null },
      });

      // optional: remove joins once deleted
      await tx.galleryVideo.deleteMany({ where: { galleryId: { in: ids } } });

      // ✅ decrement reserved storage
      if (totalDec > BigInt(0)) {
        await tx.org.update({
          where: { id: owner.orgId },
          data: { storageUsedBytes: { decrement: totalDec } },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: err?.message === "Forbidden" ? 403 : 500 });
  }
}