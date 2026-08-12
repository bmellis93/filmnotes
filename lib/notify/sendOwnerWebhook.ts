import "server-only";
import { prisma } from "@/lib/prisma";

export type OwnerWebhookEvent = "comment" | "approved" | "changes_requested";

export type OwnerWebhookPayload = {
  event: OwnerWebhookEvent;
  orgId: string;
  videoId: string;
  videoTitle: string | null;
  shareToken: string;
  ownerUrl: string;
  body: string | null;
  timecodeMs: number | null;
  occurredAt: string;
};

/** Looks up what's needed to build an owner-app deep link + video title for a webhook payload. */
export async function getOwnerVideoContext(videoId: string): Promise<{ galleryId: string | null; title: string | null }> {
  const [video, galleryVideo] = await Promise.all([
    prisma.video.findUnique({ where: { id: videoId }, select: { title: true } }),
    prisma.galleryVideo.findFirst({ where: { videoId }, select: { galleryId: true } }),
  ]);

  return { galleryId: galleryVideo?.galleryId ?? null, title: video?.title ?? null };
}

export function buildOwnerVideoUrl(origin: string, galleryId: string | null, videoId: string): string {
  if (!galleryId) return `${origin}/owner/galleries`;
  return `${origin}/owner/galleries/${galleryId}/videos/${videoId}`;
}

/**
 * Best-effort notification -- never let a webhook failure affect the
 * client-facing request that triggered it. Awaited (not truly "fire and
 * forget") because serverless functions can freeze right after the response
 * is sent, which would silently drop an unawaited fetch.
 */
export async function sendOwnerWebhook(payload: OwnerWebhookPayload): Promise<void> {
  try {
    const org = await prisma.org.findUnique({
      where: { id: payload.orgId },
      select: { notificationWebhookUrl: true },
    });

    const url = org?.notificationWebhookUrl;
    if (!url) return;

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("Owner webhook notify failed:", err);
  }
}
