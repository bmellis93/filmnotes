import "server-only";
import { prisma } from "@/lib/prisma";
import { getOwnerVideoContext, buildOwnerVideoUrl, sendOwnerBatchWebhook } from "@/lib/notify/sendOwnerWebhook";
import { sendOwnerEmail } from "@/lib/notify/sendOwnerEmail";

const MAX_COMMENTS_IN_PAYLOAD = 10;

// Comment bodies are client-authored -- never interpolate raw into HTML.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  const ownerUrl = buildOwnerVideoUrl(origin, galleryId, videoId);

  const webhookResult = await sendOwnerBatchWebhook({
    event: "comments_batch",
    orgId: video.orgId,
    videoId,
    videoTitle: title,
    ownerUrl,
    clientFirstName,
    count: pending.length,
    comments: pending.slice(0, MAX_COMMENTS_IN_PAYLOAD).map((c) => ({
      body: c.body,
      timecodeMs: c.timecodeMs,
    })),
    occurredAt: new Date().toISOString(),
  });

  const who = clientFirstName ? escapeHtml(clientFirstName) : "A client";
  const commentsHtml = pending
    .slice(0, MAX_COMMENTS_IN_PAYLOAD)
    .map((c) => `<li>${escapeHtml(c.body)}</li>`)
    .join("");

  const emailResult = await sendOwnerEmail({
    orgId: video.orgId,
    videoId,
    subject: `${who} left ${pending.length} comment${pending.length === 1 ? "" : "s"} on ${title ?? "your video"}`,
    html: `
      <p>${who} left ${pending.length} comment${pending.length === 1 ? "" : "s"} on <strong>${escapeHtml(title ?? "your video")}</strong>:</p>
      <ul>${commentsHtml}</ul>
      <p><a href="${ownerUrl}">Open in FilmNotes</a></p>
    `,
  });

  // Only mark these comments as notified if every configured channel
  // actually delivered. Otherwise leave the marker where it was so the next
  // flush (the reviewer's next page-leave, or the daily cron) retries --
  // previously a failed/non-2xx send still advanced the marker, which lost
  // the notification for good. A retry may re-send on a channel that did
  // succeed; a duplicate beats a silent miss.
  if (webhookResult === "failed" || emailResult === "failed") {
    throw new Error(`Comment notification delivery failed (webhook: ${webhookResult}, email: ${emailResult})`);
  }

  const maxCreatedAt = pending[pending.length - 1].createdAt;

  await prisma.video.update({
    where: { id: videoId },
    data: { commentsNotifiedThroughAt: maxCreatedAt },
  });
}
