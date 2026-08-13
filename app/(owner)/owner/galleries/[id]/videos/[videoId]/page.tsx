import { notFound } from "next/navigation";
import VideoReviewScreen from "@/components/review/VideoReviewScreen";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getOwnerVideoReviewData } from "@/lib/owner/videoReviewData";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ id: string; videoId: string }>;
};

export default async function OwnerGalleryVideoPage({ params }: Props) {
  const owner = await requireOwnerContext();

  const { id, videoId } = await params; // ✅ unwrap params promise

  const galleryId = String(id || "").trim();
  const vId = String(videoId || "").trim();
  if (!galleryId || !vId) notFound();

  const data = await getOwnerVideoReviewData(owner.orgId, galleryId, vId);
  if (!data) notFound();

  return (
    <VideoReviewScreen
      mode="owner"
      videoId={data.videoId}
      projectTitle={data.projectTitle}
      stacks={data.stacks}
      videoMetaById={data.videoMetaById}
      backHref={`/owner/galleries/${galleryId}`}
      view="REVIEW_DOWNLOAD"
      initialApprovalStatus={data.initialApprovalStatus}
      initialApprovalUpdatedAt={data.initialApprovalUpdatedAt}
      initialChangeNote={data.initialChangeNote}
      viewInfo={data.viewInfo}
    />
  );
}