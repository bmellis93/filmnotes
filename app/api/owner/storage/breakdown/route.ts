import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { STORAGE_LIMIT_BYTES } from "@/lib/storageLimit";

export const runtime = "nodejs";

type GalleryBucket = {
  galleryId: string;
  galleryName: string;
  bytes: bigint;
  activeBytes: bigint;
  archivedBytes: bigint;
  videoCount: number;
};

export async function GET() {
  try {
    const owner = await requireOwnerContext();
    requireRole(owner, "VIEWER");
    const orgId = owner.orgId;

    // Fast counter (what your pill uses)
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { storageUsedBytes: true },
    });

    const counterUsed = BigInt((org as any)?.storageUsedBytes ?? 0);

    // Pull videos + their gallery association(s)
    const videos = await prisma.video.findMany({
      where: {
        orgId,
        deletedAt: null,
        originalSize: { not: null },
      },
      select: {
        id: true,
        title: true,
        originalSize: true,
        archivedAt: true,
        createdAt: true,
        galleryVideos: {
          select: {
            gallery: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    // Totals from rows (reality)
    let usedBytes = BigInt(0);
    let activeBytes = BigInt(0);
    let archivedBytes = BigInt(0);

    // Gallery buckets
    const byGallery = new Map<string, GalleryBucket>();

    // Largest videos list
    const largest = videos
      .map((v) => ({
        id: v.id,
        title: v.title ?? "Untitled",
        sizeBytes: Number(v.originalSize ?? 0),
        archivedAt: v.archivedAt ? v.archivedAt.toISOString() : null,
        createdAt: v.createdAt.toISOString(),
        galleryId: v.galleryVideos?.[0]?.gallery?.id ?? null,
        galleryName: v.galleryVideos?.[0]?.gallery?.title ?? null,
      }))
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, 10);

    for (const v of videos) {
      const size = BigInt(Number(v.originalSize ?? 0));
      if (size <= BigInt(0)) continue;

      usedBytes += size;

      const isArchived = Boolean(v.archivedAt);
      if (isArchived) archivedBytes += size;
      else activeBytes += size;

      // Bucket into every gallery this video belongs to (robust)
      for (const gv of v.galleryVideos ?? []) {
        const g = gv.gallery;
        if (!g) continue;

        const galleryId = g.id;
        const galleryName = g.title ?? `Gallery ${g.id}`;

        const existing = byGallery.get(galleryId) ?? {
          galleryId,
          galleryName,
          bytes: BigInt(0),
          activeBytes: BigInt(0),
          archivedBytes: BigInt(0),
          videoCount: 0,
        };

        existing.bytes += size;
        existing.videoCount += 1;
        if (isArchived) existing.archivedBytes += size;
        else existing.activeBytes += size;

        byGallery.set(galleryId, existing);
      }
    }

    const topGalleries = Array.from(byGallery.values())
      .sort((a, b) => Number(b.bytes - a.bytes))
      .slice(0, 10)
      .map((g) => ({
        galleryId: g.galleryId,
        galleryName: g.galleryName,
        videoCount: g.videoCount,
        bytes: g.bytes.toString(),
        activeBytes: g.activeBytes.toString(),
        archivedBytes: g.archivedBytes.toString(),
      }));

    return NextResponse.json({
      ok: true,

      limitBytes: STORAGE_LIMIT_BYTES.toString(),

      // “truth” from summing videos
      usedBytes: usedBytes.toString(),
      activeBytes: activeBytes.toString(),
      archivedBytes: archivedBytes.toString(),

      // fast counter (can drift)
      counterUsedBytes: counterUsed.toString(),

      topGalleries,
      largestVideos: largest,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Server error" },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}