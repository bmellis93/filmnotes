// app/api/owner/videos/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { mux } from "@/lib/mux";
import { deleteFromR2, deleteFromR2Public } from "@/lib/r2Delete";
import { normalizeStacks, safeParseStacks } from "@/lib/stacks/normalizeStacks";

export const runtime = "nodejs";

type Action = "ARCHIVE" | "UNARCHIVE" | "DELETE";

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

/**
 * For any galleries that include these videoIds, rewrite stacksJson so it
 * doesn't reference archived/deleted ids (or any ids no longer visible).
 *
 * We prune against "visible" ids (not deleted, not archived).
 */
async function pruneStacksForVideos(ownerOrgId: string, videoIds: string[]) {
  if (videoIds.length === 0) return;

  // Which galleries are impacted?
  const joins = await prisma.galleryVideo.findMany({
    where: { videoId: { in: videoIds } },
    select: { galleryId: true },
    distinct: ["galleryId"],
  });

  const galleryIds = joins.map((j) => j.galleryId);
  if (galleryIds.length === 0) return;

  await prisma.$transaction(async (tx) => {
    const galleries = await tx.gallery.findMany({
      where: { id: { in: galleryIds }, orgId: ownerOrgId, deletedAt: null },
      select: { id: true, stacksJson: true },
    });

    for (const g of galleries) {
      // Allowed ids = in this gallery AND not archived/deleted
      const rows = await tx.galleryVideo.findMany({
        where: { galleryId: g.id },
        select: {
          video: { select: { id: true, archivedAt: true, deletedAt: true } },
        },
      });

      const allowed = new Set(
        rows
          .map((r) => r.video)
          .filter((v) => !v.deletedAt && !v.archivedAt)
          .map((v) => v.id)
      );

      const current = safeParseStacks(g.stacksJson);
      const next = normalizeStacks(current, allowed);

      const nextJson = JSON.stringify(next);
      const curJson = JSON.stringify(current);

      if (nextJson !== curJson) {
        await tx.gallery.update({
          where: { id: g.id },
          data: { stacksJson: nextJson },
        });
      }
    }
  });
}

async function pruneStacksForDeletedVideos(ownerOrgId: string, deletedVideoIds: string[]) {
  if (deletedVideoIds.length === 0) return;

  // Find impacted galleries BEFORE joins are removed
  const joins = await prisma.galleryVideo.findMany({
    where: { videoId: { in: deletedVideoIds } },
    select: { galleryId: true },
    distinct: ["galleryId"],
  });

  const galleryIds = joins.map((j) => j.galleryId);
  if (galleryIds.length === 0) return;

  await prisma.$transaction(async (tx) => {
    const galleries = await tx.gallery.findMany({
      where: { id: { in: galleryIds }, orgId: ownerOrgId, deletedAt: null },
      select: { id: true, stacksJson: true },
    });

    for (const g of galleries) {
      // Allowed = all remaining video ids in this gallery (archived are allowed; deleted are not)
      const rows = await tx.galleryVideo.findMany({
        where: { galleryId: g.id },
        select: { videoId: true },
      });

      const allowed = new Set(rows.map((r) => r.videoId));

      const current = safeParseStacks(g.stacksJson);
      const next = normalizeStacks(current, allowed);

      const nextJson = JSON.stringify(next);
      const curJson = JSON.stringify(current);

      if (nextJson !== curJson) {
        await tx.gallery.update({
          where: { id: g.id },
          data: { stacksJson: nextJson },
        });
      }
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const owner = await requireOwnerContext();

    const body = (await req.json().catch(() => ({}))) as {
      videoIds?: string[];
      action?: Action;
    };

    const videoIds = Array.isArray(body.videoIds) ? body.videoIds.map(String) : [];
    const action = body.action as Action;

    if (!videoIds.length) {
      return NextResponse.json({ error: "videoIds required" }, { status: 400 });
    }
    if (!action || !["ARCHIVE", "UNARCHIVE", "DELETE"].includes(action)) {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    // Fetch videos (org-scoped, not deleted)
    const videos = await prisma.video.findMany({
      where: { id: { in: videoIds }, orgId: owner.orgId, deletedAt: null },
      select: {
        id: true,
        muxAssetId: true,
        originalKey: true,
        originalSize: true,
        thumbnailKey: true,
        thumbnailIsCustom: true,
      },
    });

    const totalDec = videos.reduce((acc, v) => {
      const n = typeof v.originalSize === "number" ? v.originalSize : 0;
      return acc + BigInt(n);
    }, BigInt(0));

    const foundIds = new Set(videos.map((v) => v.id));
    const missing = videoIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      return NextResponse.json(
        { error: `Some videoIds not found or not authorized: ${missing.join(", ")}` },
        { status: 404 }
      );
    }

    const now = new Date();

    // DELETE (Mux + R2 + soft-delete DB)
    // 1) Best effort external deletes
    for (const v of videos) {
      await safeMuxDelete(v.muxAssetId);
      await safeR2Delete(v.originalKey);
      if (v.thumbnailIsCustom) await safeR2PublicDelete(v.thumbnailKey);
    }

    // 2) Prune stacks for deleted ids (must run BEFORE we delete joins)
    await pruneStacksForDeletedVideos(owner.orgId, videoIds);

    // 3) Remove joins + comments + shares + soft delete videos + decrement storage
    await prisma.$transaction(async (tx) => {
      await tx.galleryVideo.deleteMany({ where: { videoId: { in: videoIds } } });
      await tx.comment.deleteMany({ where: { videoId: { in: videoIds } } });
      await tx.shareLink.deleteMany({ where: { videoId: { in: videoIds } } });

      await tx.video.updateMany({
        where: { id: { in: videoIds }, orgId: owner.orgId },
        data: { deletedAt: now, archivedAt: null },
      });

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
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}