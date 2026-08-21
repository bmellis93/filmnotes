// /lib/share/fetchShare.ts
import "server-only";
import type { StackMap } from "@/components/domain/stacks";
import type {
  ShareGalleryVideo,
  SharePermissions,
} from "@/components/share/ClientGalleryScreen";
import { prisma } from "@/lib/prisma";

export type SharePayload = {
  shareId: string; // token
  title: string;
  permissions: SharePermissions;
  allowedVideoIds: string[];
  stacks: StackMap;
  videos: ShareGalleryVideo[];
};

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// You said thumbnail auto-pick is already settled; keep this consistent with your app.
function muxThumbUrl(playbackId: string, timeSeconds: number) {
  return `https://images.mux.com/${playbackId}/thumbnail.jpg?time=${timeSeconds}`;
}

function pickThumbTimeSeconds(createdAtIso?: string) {
  // Simple + stable. You can change this later if you want variety.
  return 5;
}

export async function fetchShare(shareId: string): Promise<SharePayload | null> {
  const share = await prisma.shareLink.findUnique({
    where: { token: shareId },
    select: {
      token: true,
      title: true,
      view: true,
      allowComments: true,
      allowDownload: true,
      videoId: true,
      allowedVideoIdsJson: true,
      stacksJson: true,
      expiresAt: true,
    },
  });

  if (!share) return null;

  // Matches requireValidShareToken's enforcement for the current /r/[token]
  // flow -- this legacy route was letting expired links keep working forever.
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;

  // Allowed IDs: gallery shares use allowedVideoIdsJson; single-video shares fall back to videoId
  const parsedAllowed = parseJsonArray(share.allowedVideoIdsJson);
  const allowedVideoIds =
    parsedAllowed.length > 0
      ? parsedAllowed
      : share.videoId
      ? [share.videoId]
      : [];

  // 🔒 limit stacks to videos actually allowed in this share
  const allowedSet = new Set(allowedVideoIds);
  const stacks = Object.fromEntries(
    Object.entries(parseJsonObject<StackMap>(share.stacksJson, {})).filter(
      ([parentId]) => allowedSet.has(parentId)
    )
  );

  const permissions: SharePermissions = {
    view: share.view === "VIEW_ONLY" ? "VIEW_ONLY" : "REVIEW_DOWNLOAD",
    allowComments: Boolean(share.allowComments),
    allowDownload: Boolean(share.allowDownload),
  };

  // If the share is malformed (no allowed ids), return a consistent payload
  if (allowedVideoIds.length === 0) {
    return {
      shareId: share.token,
      title: share.title ?? "Shared Gallery",
      permissions,
      allowedVideoIds: [],
      stacks,
      videos: [],
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
    shareId: share.token,
    title: share.title ?? "Shared Gallery",
    permissions,
    allowedVideoIds,
    stacks,
    videos,
  };
}