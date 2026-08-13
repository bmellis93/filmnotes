// lib/owner/galleriesData.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import type { OwnerGalleryListItem } from "@/components/owner/OwnerGalleriesClient";

function muxThumbUrl(playbackId: string, timeSeconds: number) {
  return `https://images.mux.com/${playbackId}/thumbnail.jpg?time=${timeSeconds}`;
}

// Shared by the standalone Server Component page (app/(owner)/owner/galleries)
// and the embed's client-fetched GET /api/owner/galleries -- keeping this in
// one place means the two entry points can't silently drift apart.
export async function getOwnerGalleriesList(orgId: string): Promise<OwnerGalleryListItem[]> {
  const galleries = await prisma.gallery.findMany({
    where: {
      orgId,
      deletedAt: null,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      videos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 4,
        select: {
          video: {
            select: {
              id: true,
              title: true,
              thumbnailUrl: true,
              muxPlaybackId: true,
              playbackUrl: true,
            },
          },
        },
      },
    },
  });

  return galleries.map((g) => {
    const thumbs = g.videos
      .map(({ video }) => {
        if (video.thumbnailUrl) return { url: video.thumbnailUrl, alt: video.title };
        if (video.muxPlaybackId) return { url: muxThumbUrl(video.muxPlaybackId, 5), alt: video.title };
        return null;
      })
      .filter(Boolean)
      .slice(0, 4) as { url: string; alt?: string }[];

    return {
      id: g.id,
      name: g.title ?? "Untitled gallery",
      description: null,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      lastClientCommentedAt: null,
      thumbs,
    };
  });
}
