// /lib/share/fetchShare.ts
import "server-only";
import type { StackMap } from "@/components/domain/stacks";
import type {
  ShareGalleryVideo,
  SharePermissions,
} from "@/components/share/ClientGalleryScreen";
import { prisma } from "@/lib/prisma";
import { loadGatedShare } from "@/lib/share/shareGate";
import { resolveShareVideos } from "@/lib/share/resolveShareVideos";

export type SharePayload = {
  shareId: string; // token
  title: string;
  permissions: SharePermissions;
  allowedVideoIds: string[];
  stacks: StackMap;
  videos: ShareGalleryVideo[];
};

export type FetchShareResult =
  | { ok: true; share: SharePayload }
  | { ok: false; status: number; error: string; passwordRequired?: true };

// You said thumbnail auto-pick is already settled; keep this consistent with your app.
function muxThumbUrl(playbackId: string, timeSeconds: number) {
  return `https://images.mux.com/${playbackId}/thumbnail.jpg?time=${timeSeconds}`;
}

function pickThumbTimeSeconds(createdAtIso?: string) {
  // Simple + stable. You can change this later if you want variety.
  return 5;
}

// "shareId" here is actually the share's token (legacy route naming) --
// requireValidShareToken and this both look up ShareLink by token.
export async function fetchShare(shareId: string, unlockProof?: string | null): Promise<FetchShareResult> {
  const gate = await loadGatedShare(shareId, unlockProof ?? null);
  if (!gate.ok) return gate;

  const share = gate.share;

  // Computed live from the gallery's current state -- see
  // resolveShareVideos for why this isn't just parsing the share's own
  // frozen allowedVideoIdsJson/stacksJson columns.
  const { allowedVideoIds, stacks } = await resolveShareVideos(share);

  const permissions: SharePermissions = {
    view: share.view === "VIEW_ONLY" ? "VIEW_ONLY" : "REVIEW_DOWNLOAD",
    allowComments: Boolean(share.allowComments),
    allowDownload: Boolean(share.allowDownload),
  };

  // If the share is malformed (no allowed ids), return a consistent payload
  if (allowedVideoIds.length === 0) {
    return {
      ok: true,
      share: {
        shareId: share.token,
        title: share.title ?? "Shared Gallery",
        permissions,
        allowedVideoIds: [],
        stacks,
        videos: [],
      },
    };
  }

  // Fetch only the allowed videos
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

  const byId = new Map(rows.map((v) => [v.id, v]));

  // Preserve the share's ordering
  const videos: ShareGalleryVideo[] = allowedVideoIds
    .map((id) => {
      const v = byId.get(id);
      if (!v) return null; // id in allowed list but missing in DB

      const thumb =
        v.thumbnailUrl ??
        (v.muxPlaybackId
          ? muxThumbUrl(v.muxPlaybackId, pickThumbTimeSeconds(v.createdAt.toISOString()))
          : null);

      return {
        id: v.id,
        name: v.title,
        description: v.description ?? "",
        createdAt: v.createdAt.toISOString(),
        thumbnailUrl: thumb,
      };
    })
    .filter(Boolean) as ShareGalleryVideo[];

  return {
    ok: true,
    share: {
      shareId: share.token,
      title: share.title ?? "Shared Gallery",
      permissions,
      allowedVideoIds,
      stacks,
      videos,
    },
  };
}
