import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotifyResult } from "@/lib/notify/sendOwnerWebhook";

/**
 * Direct owner-notification email via Resend -- an alternative to the GHL
 * webhook path (lib/notify/sendOwnerWebhook.ts) that needs no GHL workflow
 * setup. Independent and best-effort, same as the webhook: never throws,
 * never affects the request that triggered it, no-ops if the org hasn't
 * configured a notification email.
 *
 * Recipients: the org's Settings notification email plus, when `videoId` is
 * given, the email of the user who uploaded that video -- deduped
 * case-insensitively, so one person never gets the same email twice.
 * Resolves to whether delivery succeeded,
 * same contract as the webhook (a non-2xx from Resend is a failure).
 */
export async function sendOwnerEmail({
  orgId,
  videoId,
  subject,
  html,
}: {
  orgId: string;
  videoId?: string;
  subject: string;
  html: string;
}): Promise<NotifyResult> {
  try {
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { notificationEmail: true },
    });

    const uploaderId = videoId
      ? (await prisma.video.findUnique({ where: { id: videoId }, select: { uploadedByUserId: true } }))
          ?.uploadedByUserId
      : null;
    const uploader = uploaderId
      ? await prisma.appUser.findUnique({ where: { id: uploaderId }, select: { email: true } })
      : null;

    const to: string[] = [];
    for (const raw of [org?.notificationEmail, uploader?.email]) {
      const email = raw?.trim();
      if (email && !to.some((t) => t.toLowerCase() === email.toLowerCase())) to.push(email);
    }
    if (to.length === 0) return "skipped";

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      // Misconfiguration, not a transient failure -- "skipped" so the comment
      // flush doesn't retry (and re-send the webhook) indefinitely over it.
      console.error("Owner email notify skipped: RESEND_API_KEY / RESEND_FROM_EMAIL not set");
      return "skipped";
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Owner email notify failed: HTTP ${res.status} (org ${orgId})`, text.slice(0, 500));
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(`Owner email notify failed (org ${orgId}):`, err);
    return "failed";
  }
}
