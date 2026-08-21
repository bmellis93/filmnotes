import "server-only";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, hasRole } from "@/lib/auth/ownerSession";
import { getShareContextFromRequest } from "@/lib/auth/shareContext";

export type VideoAccess =
  | { allowed: true; orgId: string }
  | { allowed: false };

/**
 * Shared permission check for endpoints that serve either the owner (via
 * session cookie) or a client viewing through a share link (via token).
 * Set `requireAllowDownload` for endpoints gated by the share link's
 * "Allow downloads" toggle (viewing/playback should not require it).
 */
export async function resolveVideoAccess(
  req: NextRequest,
  videoId: string,
  opts?: { requireAllowDownload?: boolean }
): Promise<VideoAccess> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, orgId: true },
  });

  if (!video) return { allowed: false };

  // Owner access
  try {
    const owner = await requireOwnerContext();
    if (owner.orgId === video.orgId && hasRole(owner, "VIEWER")) {
      return { allowed: true, orgId: video.orgId };
    }
  } catch {
    // not an owner session, fall through to share-token check
  }

  // Share-token access (only if not owner)
  const share = await getShareContextFromRequest(req);
  if (
    share &&
    share.orgId === video.orgId &&
    share.videoIds.includes(videoId) &&
    (!opts?.requireAllowDownload || share.allowDownload)
  ) {
    return { allowed: true, orgId: video.orgId };
  }

  return { allowed: false };
}
