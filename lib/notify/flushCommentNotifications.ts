import "server-only";
import { prisma } from "@/lib/prisma";
import { getOwnerVideoContext, buildOwnerVideoUrl, sendOwnerBatchWebhook } from "@/lib/notify/sendOwnerWebhook";

const MAX_COMMENTS_IN_PAYLOAD = 10;

/**
 * Sends one batched owner notification for every client comment posted on a
 * video since the last flush, instead of one webhook per comment. Called
 * from the client-side debounce/browse-away hook (see
 * components/review/useFlushCommentNotifications.ts) and, as a fallback,
 * the daily cron (app/api/cron/flush-comment-notifications/route.ts).
 *
 * Safe to call defensively/often -- no-ops cheaply when there's nothing new.
 *
 * `origin` builds the deep link back into the owner app (e.g. from the
 * calling request's `new URL(req.url).origin`); falls back to the app's one
 * production domain (see README) for callers without a request, like cron.
 */
export async function flushPendingCommentNotifications(
  videoId: string,
  origin = "https://filmnotes.app"
): Promise<void> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { orgId: true, commentsNotifiedThroughAt: true },
  });
  if (!video) return;

  const since = video.commentsNotifiedThroughAt ?? new Date(0);

  const pending = await prisma.comment.findMany({
    where: { videoId, role: "CLIENT", createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    select: { body: true, timecodeMs: true, token: true, createdAt: true },
  });

  if (pending.length === 0) return;

  const latestToken = pending[pending.length - 1].token;
  const share = await prisma.shareLink.findFirst({
    where: { token: latestToken },
    select: { contactName: true },
  });
  const clientFirstName = share?.contactName?.trim().split(/\s+/)[0] || null;

  const { galleryId, title } = await getOwnerVideoContext(videoId);

  await sendOwnerBatchWebhook({
    event: "comments_batch",
    orgId: video.orgId,
    videoId,
    videoTitle: title,
    ownerUrl: buildOwnerVideoUrl(origin, galleryId, videoId),
    clientFirstName,
    count: pending.length,
    comments: pending.slice(0, MAX_COMMENTS_IN_PAYLOAD).map((c) => ({
      body: c.body,
      timecodeMs: c.timecodeMs,
    })),
    occurredAt: new Date().toISOString(),
  });

  const maxCreatedAt = pending[pending.length - 1].createdAt;

  await prisma.video.update({
    where: { id: videoId },
    data: { commentsNotifiedThroughAt: maxCreatedAt },
  });
}
