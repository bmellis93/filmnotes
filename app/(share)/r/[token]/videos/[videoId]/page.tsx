// app/(share)/r/[token]/videos/[videoId]/page.tsx
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import VideoReviewScreen from "@/components/review/VideoReviewScreen";
import SharePasswordGate from "@/components/share/SharePasswordGate";
import { requireValidShareToken } from "@/lib/share-auth";
import { unlockCookieName } from "@/lib/share/sharePassword";
import { resolveShareVideos } from "@/lib/share/resolveShareVideos";
import { resolveVideoPermissions } from "@/lib/share/resolveVideoPermissions";
import { buildChildToParent, latestIdForCard } from "@/components/domain/stacks";
import { prisma } from "@/lib/prisma";
import { buildVideoMaps } from "@/lib/videoMaps";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ token: string; videoId: string }>;
};

export default async function TokenVideoPage({ params }: Props) {
  const { token: rawToken, videoId: rawVideoId } = await params;

  const token = String(rawToken || "").trim();
  const videoId = String(rawVideoId || "").trim();
  if (!token || !videoId) notFound();

  const unlockProof = (await cookies()).get(unlockCookieName(token))?.value ?? null;
  const res = await requireValidShareToken(token, unlockProof);
  if (!res.ok) {
    if (res.passwordRequired) return <SharePasswordGate token={token} />;
    notFound();
  }

  const share = res.share;

  const { allowedVideoIds: allowed, stacks } = await resolveShareVideos(share);
  if (!allowed.includes(videoId)) notFound();

  // Redirect to latest in stack (keeps URL stable + avoids viewing old versions)
  const childToParent = buildChildToParent(stacks);
  const latestId = latestIdForCard(videoId, stacks, childToParent);
  if (latestId !== videoId) {
    redirect(`/r/${token}/videos/${latestId}`);
  }

  // Fetch ONLY allowed videos (no full-table scan)
  const videos = await prisma.video.findMany({
    where: { id: { in: allowed } },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      thumbnailUrl: true,
      sourceUrl: true,
      playbackUrl: true, // use this for viewing when available
      approvalStatus: true,
      approvalUpdatedAt: true,
      changeNote: true,
    },
  });

  const { videoMetaById } = buildVideoMaps(videos);
  const currentVideo = videos.find((v) => v.id === videoId);

  const permissions = resolveVideoPermissions(
    Boolean(share.allowComments),
    Boolean(share.allowDownload),
    share.videoPermissionsJson,
    videoId
  );

  return (
    <VideoReviewScreen
      mode="token"
      token={token}
      videoId={videoId}
      stacks={stacks}
      projectTitle={share.title ?? "Client Gallery"}
      view={share.view === "VIEW_ONLY" ? "VIEW_ONLY" : "REVIEW_DOWNLOAD"}
      backHref={`/r/${token}`}
      permissions={permissions}
      videoMetaById={videoMetaById}
      initialApprovalStatus={currentVideo?.approvalStatus}
      initialApprovalUpdatedAt={currentVideo?.approvalUpdatedAt?.toISOString() ?? null}
      initialChangeNote={currentVideo?.changeNote ?? null}
    />
  );
}