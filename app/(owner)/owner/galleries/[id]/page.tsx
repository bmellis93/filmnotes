import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GalleryDetailScreen from "@/components/owner/GalleryDetailScreen";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getViewSummariesForVideos } from "@/lib/views/getViewSummary";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ id: string }>;
};

function safeParseStacks(stacksJson: string | null | undefined) {
  if (!stacksJson) return {};
  try {
    const obj = JSON.parse(stacksJson);
    return obj && typeof obj === "object" ? (obj as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

export default async function OwnerGalleryDetailPage({ params }: Props) {
  const owner = await requireOwnerContext();
  
  const { id } = await params; // ✅ IMPORTANT
  const galleryId = String(id || "").trim();
  if (!galleryId) notFound();

  const gallery = await prisma.gallery.findFirst({
    where: { id: galleryId, orgId: owner.orgId, archivedAt: null, deletedAt: null },
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

  if (!gallery) notFound();

  const stacks = safeParseStacks(gallery.stacksJson);

  // Count versions for stack parents (versionsCount badge)
  const versionsCountById = new Map<string, number>();
  for (const [parentId, ids] of Object.entries(stacks)) {
    versionsCountById.set(parentId, Array.isArray(ids) ? ids.length : 1);
    // (optional) also set count on children if you want consistent badge behavior
    for (const childId of ids ?? []) versionsCountById.set(childId, (ids ?? []).length);
  }

  const viewSummaries = await getViewSummariesForVideos(gallery.videos.map((gv) => gv.video.id));

  const initialVideos = gallery.videos.map((gv) => {
    const v = gv.video;

    // Normalize DB status -> UI status
    // (keep UPLOADED distinct if you want; VideoGrid now supports it either way)
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

  return (
    <GalleryDetailScreen
      gallery={{
        id: gallery.id,
        name: gallery.title ?? `Gallery ${gallery.id}`,
        description: "", // add a Gallery.description column later if you want
      }}
      initialVideos={initialVideos}
      initialStacks={stacks}
    />
  );
}