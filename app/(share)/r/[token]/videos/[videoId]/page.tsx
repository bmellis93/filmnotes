// app/(share)/r/[token]/videos/[videoId]/page.tsx
import { notFound, redirect } from "next/navigation";
import VideoReviewScreen from "@/components/review/VideoReviewScreen";
import { requireValidShareToken } from "@/lib/share-auth";
import { parseAllowedIds, parseStacks } from "@/lib/share/shareLinkUtils";
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

  const res = await requireValidShareToken(token);
  if (!res.ok) notFound();

  const share = res.share;

  const allowed = parseAllowedIds(share);
  if (!allowed.includes(videoId)) notFound();

  const stacks = parseStacks(share, allowed);

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
    },
  });

  const { videoMetaById } = buildVideoMaps(videos);

  return (
    <VideoReviewScreen
      mode="token"
      token={token}
      videoId={videoId}
      stacks={stacks}
      projectTitle={share.title ?? "Client Gallery"}
      view={share.view === "VIEW_ONLY" ? "VIEW_ONLY" : "REVIEW_DOWNLOAD"}
      backHref={`/r/${token}`}
      permissions={{
        allowComments: Boolean(share.allowComments),
        allowDownload: Boolean(share.allowDownload),
      }}
      videoMetaById={videoMetaById}
    />
  );
}