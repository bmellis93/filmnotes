import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ClientGalleryScreen, {
  type ShareGalleryVideo,
  type SharePermissions,
} from "@/components/share/ClientGalleryScreen";
import SharePasswordGate from "@/components/share/SharePasswordGate";

import { prisma } from "@/lib/prisma";
import { requireValidShareToken } from "@/lib/share-auth";
import { unlockCookieName } from "@/lib/share/sharePassword";
import { parseAllowedIds, parseStacks } from "@/lib/share/shareLinkUtils";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ token: string }>;
};

function muxThumbUrl(playbackId: string, timeSeconds: number) {
  return `https://images.mux.com/${playbackId}/thumbnail.jpg?time=${timeSeconds}`;
}

export default async function ShareTokenPage({ params }: Props) {
  const { token } = await params;
  const cleanToken = String(token || "").trim();

  const unlockProof = (await cookies()).get(unlockCookieName(cleanToken))?.value ?? null;
  const res = await requireValidShareToken(cleanToken, unlockProof);
  if (!res.ok) {
    if (res.passwordRequired) return <SharePasswordGate token={cleanToken} />;
    notFound();
  }

  const share = res.share;

  if (share.videoId) {
    redirect(`/r/${cleanToken}/videos/${share.videoId}`);
  }

  const allowedVideoIds = parseAllowedIds(share);
  const stacks = parseStacks(share, allowedVideoIds);

  const rows = await prisma.video.findMany({
    where: { id: { in: allowedVideoIds } },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      thumbnailUrl: true,
      muxPlaybackId: true,
    },
  });

  // ✅ re-order in the exact allowedVideoIds order
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const videos: ShareGalleryVideo[] = allowedVideoIds
    .map((id) => {
      const v = rowById.get(id);
      if (!v) return null;

      const thumb =
        v.thumbnailUrl ?? (v.muxPlaybackId ? muxThumbUrl(v.muxPlaybackId, 5) : null);

      return {
        id: v.id,
        name: v.title,
        description: v.description ?? "",
        createdAt: v.createdAt.toISOString(),
        thumbnailUrl: thumb,
      };
    })
    .filter(Boolean) as ShareGalleryVideo[];

  const permissions: SharePermissions = {
    view: share.view === "VIEW_ONLY" ? "VIEW_ONLY" : "REVIEW_DOWNLOAD",
    allowComments: Boolean(share.allowComments),
    allowDownload: Boolean(share.allowDownload),
  };

  return (
    <ClientGalleryScreen
      shareId={cleanToken}
      title={share.title ?? "Client Gallery"}
      videos={videos}
      stacks={stacks}
      permissions={permissions}
      token={cleanToken}
    />
  );
}