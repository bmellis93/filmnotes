import "server-only";
import { prisma } from "@/lib/prisma";

export type OwnerWebhookEvent = "approved" | "changes_requested";

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

export type OwnerCommentsBatchWebhookPayload = {
  event: "comments_batch";
  orgId: string;
  videoId: string;
  videoTitle: string | null;
  ownerUrl: string;
  clientFirstName: string | null;
  count: number;
  comments: { body: string; timecodeMs: number }[];
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
 * caller that triggered it. Awaited (not truly "fire and forget") because
 * serverless functions can freeze right after the response is sent, which
 * would silently drop an unawaited fetch.
 */
async function postToOwnerWebhook(
  orgId: string,
  payload: OwnerWebhookPayload | OwnerCommentsBatchWebhookPayload
): Promise<void> {
  try {
    const org = await prisma.org.findUnique({
      where: { id: orgId },
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

export async function sendOwnerWebhook(payload: OwnerWebhookPayload): Promise<void> {
  return postToOwnerWebhook(payload.orgId, payload);
}

/** Single POST summarizing a batch of client comments, in place of one-per-comment. */
export async function sendOwnerBatchWebhook(payload: OwnerCommentsBatchWebhookPayload): Promise<void> {
  return postToOwnerWebhook(payload.orgId, payload);
}
