import { notFound } from "next/navigation";
import VideoReviewScreen from "@/components/review/VideoReviewScreen";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { safeParseStacks, buildVideoMaps } from "@/lib/videoMaps";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

const gallerySelect = Prisma.validator<Prisma.GalleryDefaultArgs>()({
  select: {
    id: true,
    title: true,
    stacksJson: true,
    videos: {
      // ✅ allow archived videos to be viewable if you want (only block deleted)
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
            playbackUrl: true, // ✅ include here so we don't need a second query
            archivedAt: true,
            deletedAt: true,
          },
        },
      },
    },
  },
});

type GalleryPayload = Prisma.GalleryGetPayload<typeof gallerySelect>;

type Props = {
  params: Promise<{ id: string; videoId: string }>;
};

export default async function OwnerGalleryVideoPage({ params }: Props) {
  const owner = await requireOwnerContext();

  const { id, videoId } = await params; // ✅ unwrap params promise

  const galleryId = String(id || "").trim();
  const vId = String(videoId || "").trim();
  if (!galleryId || !vId) notFound();

  const gallery: GalleryPayload | null = await prisma.gallery.findFirst({
    where: {
      id: galleryId,
      orgId: owner.orgId,
      deletedAt: null,
      // ✅ up to you:
      // archivedAt: null, // (uncomment if you want archived galleries NOT viewable)
    },
    ...gallerySelect,
  });

  if (!gallery) notFound();

  const stacks = safeParseStacks(gallery.stacksJson);

  const allVideos = gallery.videos.map((gv) => gv.video);
  const allowedIds = allVideos.map((v) => v.id);
  if (!allowedIds.includes(vId)) notFound();

  // Note: unlike share/client links, the owner view does NOT force-redirect
  // to the latest version — the version dropdown needs to be able to land
  // on (and stay on) any specific version in the stack.

  const { videoMetaById } = buildVideoMaps(allVideos);

  return (
    <VideoReviewScreen
      mode="owner"
      videoId={videoId}
      projectTitle={gallery.title ?? `Gallery ${galleryId}`}
      stacks={stacks}
      videoMetaById={videoMetaById}
      backHref={`/owner/galleries/${galleryId}`}
      view="REVIEW_DOWNLOAD"
    />
  );
}