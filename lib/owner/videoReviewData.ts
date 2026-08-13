// lib/owner/videoReviewData.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { safeParseStacks, buildVideoMaps, type VideoMeta, type StacksMap } from "@/lib/videoMaps";
import { getViewSummaryForVideo, type ViewSummary } from "@/lib/views/getViewSummary";

const gallerySelect = Prisma.validator<Prisma.GalleryDefaultArgs>()({
  select: {
    id: true,
    title: true,
    stacksJson: true,
    videos: {
      // allow archived videos to be viewable (only block deleted)
      where: { video: { deletedAt: null, archivedAt: null } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        video: {
          select: {
            id: true,
            title: true,
            description: true,
            createdAt: true,
            thumbnailUrl: true,
            sourceUrl: true,
            playbackUrl: true,
            archivedAt: true,
            deletedAt: true,
            approvalStatus: true,
            approvalUpdatedAt: true,
            changeNote: true,
          },
        },
      },
    },
  },
});

type GalleryPayload = Prisma.GalleryGetPayload<typeof gallerySelect>;

export type OwnerVideoReviewData = {
  videoId: string;
  projectTitle: string;
  stacks: StacksMap;
  videoMetaById: Record<string, VideoMeta>;
  initialApprovalStatus?: "PENDING" | "CHANGES_REQUESTED" | "APPROVED";
  initialApprovalUpdatedAt: string | null;
  initialChangeNote: string | null;
  viewInfo: ViewSummary | null;
};

// Shared by the standalone Server Component page
// (app/(owner)/owner/galleries/[id]/videos/[videoId]) and the embed's
// client-fetched GET /api/owner/galleries/[id]/videos/[videoId].
export async function getOwnerVideoReviewData(
  orgId: string,
  galleryId: string,
  videoId: string
): Promise<OwnerVideoReviewData | null> {
  const gallery: GalleryPayload | null = await prisma.gallery.findFirst({
    where: { id: galleryId, orgId, deletedAt: null },
    ...gallerySelect,
  });

  if (!gallery) return null;

  const stacks = safeParseStacks(gallery.stacksJson);

  const allVideos = gallery.videos.map((gv) => gv.video);
  const allowedIds = allVideos.map((v) => v.id);
  if (!allowedIds.includes(videoId)) return null;

  // Note: unlike share/client links, the owner view does NOT force-redirect
  // to the latest version -- the version dropdown needs to be able to land
  // on (and stay on) any specific version in the stack.

  const { videoMetaById } = buildVideoMaps(allVideos);
  const currentVideo = allVideos.find((v) => v.id === videoId);
  const viewInfo = await getViewSummaryForVideo(videoId);

  return {
    videoId,
    projectTitle: gallery.title ?? `Gallery ${galleryId}`,
    stacks,
    videoMetaById,
    initialApprovalStatus: currentVideo?.approvalStatus,
    initialApprovalUpdatedAt: currentVideo?.approvalUpdatedAt?.toISOString() ?? null,
    initialChangeNote: currentVideo?.changeNote ?? null,
    viewInfo,
  };
}
