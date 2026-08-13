// lib/owner/galleryDetailData.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { getViewSummariesForVideos } from "@/lib/views/getViewSummary";
import type { GalleryVideo } from "@/components/owner/VideoGrid";
import type { StackMap } from "@/components/domain/stacks";

export type OwnerGalleryDetail = {
  gallery: { id: string; name: string; description?: string };
  initialVideos: GalleryVideo[];
  initialStacks: StackMap;
};

function safeParseStacks(stacksJson: string | null | undefined): StackMap {
  if (!stacksJson) return {};
  try {
    const obj = JSON.parse(stacksJson);
    return obj && typeof obj === "object" ? (obj as StackMap) : {};
  } catch {
    return {};
  }
}

// Shared by the standalone Server Component page
// (app/(owner)/owner/galleries/[id]) and the embed's client-fetched
// GET /api/owner/galleries/[id].
export async function getOwnerGalleryDetail(
  orgId: string,
  galleryId: string
): Promise<OwnerGalleryDetail | null> {
  const gallery = await prisma.gallery.findFirst({
    where: { id: galleryId, orgId, archivedAt: null, deletedAt: null },
    select: {
      id: true,
      title: true,
      stacksJson: true,
      archivedAt: true,
      deletedAt: true,
      videos: {
        where: { video: { archivedAt: null, deletedAt: null } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          video: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              createdAt: true,
              thumbnailUrl: true,
              archivedAt: true,
              deletedAt: true,
              originalSize: true,
              approvalStatus: true,
              approvalUpdatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!gallery) return null;

  const stacks = safeParseStacks(gallery.stacksJson);

  const versionsCountById = new Map<string, number>();
  for (const [parentId, ids] of Object.entries(stacks)) {
    versionsCountById.set(parentId, Array.isArray(ids) ? ids.length : 1);
    for (const childId of ids ?? []) versionsCountById.set(childId, (ids ?? []).length);
  }

  const viewSummaries = await getViewSummariesForVideos(gallery.videos.map((gv) => gv.video.id));

  const initialVideos: GalleryVideo[] = gallery.videos.map((gv) => {
    const v = gv.video;

    const uiStatus =
      v.status === "UPLOADED"
        ? "UPLOADED"
        : v.status === "PROCESSING"
        ? "PROCESSING"
        : v.status === "FAILED"
        ? "FAILED"
        : "READY";

    return {
      id: v.id,
      name: v.title,
      description: v.description ?? "",
      status: uiStatus as "READY" | "UPLOADED" | "PROCESSING" | "FAILED",
      createdAt: v.createdAt.toISOString(),
      thumbnailUrl: v.thumbnailUrl ?? null,
      versionsCount: versionsCountById.get(v.id) ?? 1,
      archivedAt: v.archivedAt?.toISOString() ?? null,
      originalSize: v.originalSize == null ? null : Number(v.originalSize),
      approvalStatus: v.approvalStatus,
      firstViewedAt: viewSummaries.get(v.id)?.firstViewedAt ?? null,
    };
  });

  return {
    gallery: {
      id: gallery.id,
      name: gallery.title ?? `Gallery ${gallery.id}`,
      description: "",
    },
    initialVideos,
    initialStacks: stacks,
  };
}
