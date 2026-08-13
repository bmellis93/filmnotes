import { notFound } from "next/navigation";
import GalleryDetailScreen from "@/components/owner/GalleryDetailScreen";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getOwnerGalleryDetail } from "@/lib/owner/galleryDetailData";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OwnerGalleryDetailPage({ params }: Props) {
  const owner = await requireOwnerContext();

  const { id } = await params; // ✅ IMPORTANT
  const galleryId = String(id || "").trim();
  if (!galleryId) notFound();

  const detail = await getOwnerGalleryDetail(owner.orgId, galleryId);
  if (!detail) notFound();

  return (
    <GalleryDetailScreen
      gallery={detail.gallery}
      initialVideos={detail.initialVideos}
      initialStacks={detail.initialStacks}
    />
  );
}