import { notFound, redirect } from "next/navigation";
import VideoReviewScreen from "@/components/review/VideoReviewScreen";
import { prisma } from "@/lib/prisma";
import { fetchShare } from "@/lib/share/fetchShare";
import { buildChildToParent, latestIdForCard } from "@/components/domain/stacks";
import { buildVideoMaps } from "@/lib/videoMaps";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ shareId: string; videoId: string }>;
};

export default async function ClientVideoPage({ params }: Props) {
  const { shareId: rawShareId, videoId: rawVideoId } = await params;
  const shareId = String(rawShareId || "").trim();
  const videoId = String(rawVideoId || "").trim();
  if (!shareId || !videoId) notFound();

  const share = await fetchShare(shareId);
  if (!share) notFound();

  const allowed = share.allowedVideoIds ?? [];
  if (!allowed.includes(videoId)) notFound();

  // ✅ redirect parent/child → latest version
  const childToParent = buildChildToParent(share.stacks);
  const latestId = latestIdForCard(videoId, share.stacks, childToParent);
  if (latestId !== videoId) {
    redirect(`/share/${shareId}/videos/${latestId}`);
  }

  // ✅ fetch ONLY allowed video records (meta + sources)
  const videos = await prisma.video.findMany({
    where: { id: { in: allowed } },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      thumbnailUrl: true,
      sourceUrl: true,
      playbackUrl: true,
      approvalStatus: true,
      approvalUpdatedAt: true,
      changeNote: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const { videoMetaById } = buildVideoMaps(videos);
  const currentVideo = videos.find((v) => v.id === videoId);

  return (
    <VideoReviewScreen
      mode="client"
      shareId={shareId}
      videoId={videoId}
      stacks={share.stacks}
      projectTitle={share.title ?? "Client Gallery"}
      view={share.permissions?.view === "VIEW_ONLY" ? "VIEW_ONLY" : "REVIEW_DOWNLOAD"}
      backHref={`/share/${shareId}`}
      permissions={{
        allowComments: Boolean(share.permissions?.allowComments),
        allowDownload: Boolean(share.permissions?.allowDownload),
      }}
      videoMetaById={videoMetaById}
      initialApprovalStatus={currentVideo?.approvalStatus}
      initialApprovalUpdatedAt={currentVideo?.approvalUpdatedAt?.toISOString() ?? null}
      initialChangeNote={currentVideo?.changeNote ?? null}
    />
  );
}