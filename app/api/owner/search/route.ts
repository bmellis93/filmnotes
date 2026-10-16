import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { videoThumbUrl } from "@/lib/owner/galleriesData";

export const runtime = "nodejs";

const MAX_RESULTS = 25;

export type OwnerSearchResults = {
  ok: true;
  query: string;
  galleries: {
    id: string;
    name: string;
    videoCount: number;
    thumbUrl: string | null;
    archived: boolean;
  }[];
  videos: {
    id: string;
    title: string;
    // Every video page lives under a gallery route, so a video with no
    // (non-deleted) gallery has nowhere to link and is left out.
    galleryId: string;
    galleryName: string;
    thumbUrl: string | null;
    archived: boolean;
  }[];
};

/** Case-insensitive title search across the org's galleries and videos. */
export async function GET(req: NextRequest) {
  try {
    const owner = await requireOwnerContext();
    requireRole(owner, "VIEWER");

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
    if (!q) {
      return NextResponse.json({ ok: true, query: q, galleries: [], videos: [] } satisfies OwnerSearchResults);
    }

    const titleMatch = { contains: q, mode: "insensitive" as const };

    const [galleries, videos] = await Promise.all([
      prisma.gallery.findMany({
        where: { orgId: owner.orgId, deletedAt: null, title: titleMatch },
        orderBy: { updatedAt: "desc" },
        take: MAX_RESULTS,
        select: {
          id: true,
          title: true,
          archivedAt: true,
          _count: { select: { videos: { where: { video: { deletedAt: null } } } } },
          videos: {
            where: { video: { deletedAt: null } },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1,
            select: { video: { select: { thumbnailUrl: true, muxPublicPlaybackId: true } } },
          },
        },
      }),
      prisma.video.findMany({
        where: {
          orgId: owner.orgId,
          deletedAt: null,
          title: titleMatch,
          galleryVideos: { some: { gallery: { deletedAt: null } } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_RESULTS,
        select: {
          id: true,
          title: true,
          archivedAt: true,
          thumbnailUrl: true,
          muxPublicPlaybackId: true,
          galleryVideos: {
            where: { gallery: { deletedAt: null } },
            take: 1,
            select: { gallery: { select: { id: true, title: true } } },
          },
        },
      }),
    ]);

    const results: OwnerSearchResults = {
      ok: true,
      query: q,
      galleries: galleries.map((g) => ({
        id: g.id,
        name: g.title ?? "Untitled gallery",
        videoCount: g._count.videos,
        thumbUrl: g.videos[0] ? videoThumbUrl(g.videos[0].video) : null,
        archived: g.archivedAt !== null,
      })),
      videos: videos.flatMap((v) => {
        const gallery = v.galleryVideos[0]?.gallery;
        if (!gallery) return [];
        return [
          {
            id: v.id,
            title: v.title,
            galleryId: gallery.id,
            galleryName: gallery.title ?? "Untitled gallery",
            thumbUrl: videoThumbUrl(v),
            archived: v.archivedAt !== null,
          },
        ];
      }),
    };

    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    console.error("Owner search error:", err);
    return NextResponse.json({ ok: false, error: message }, { status: message === "Forbidden" ? 403 : 500 });
  }
}
