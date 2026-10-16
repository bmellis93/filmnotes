// lib/owner/galleriesData.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import type { OwnerGalleryListItem } from "@/components/owner/OwnerGalleriesClient";

function muxThumbUrl(playbackId: string, timeSeconds: number) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${timeSeconds}`;
}

/** A video's card thumbnail: its custom/uploaded one, else a Mux still. */
export function videoThumbUrl(video: {
  thumbnailUrl: string | null;
  muxPublicPlaybackId: string | null;
}): string | null {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (video.muxPublicPlaybackId) return muxThumbUrl(video.muxPublicPlaybackId, 5);
  return null;
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
      description: true,
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
              muxPublicPlaybackId: true,
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
        const url = videoThumbUrl(video);
        return url ? { url, alt: video.title } : null;
      })
      .filter(Boolean)
      .slice(0, 4) as { url: string; alt?: string }[];

    return {
      id: g.id,
      name: g.title ?? "Untitled gallery",
      description: g.description ?? null,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      lastClientCommentedAt: null,
      thumbs,
    };
  });
}
