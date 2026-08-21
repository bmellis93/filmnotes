import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Direct owner-notification email via Resend -- an alternative to the GHL
 * webhook path (lib/notify/sendOwnerWebhook.ts) that needs no GHL workflow
 * setup. Independent and best-effort, same as the webhook: never throws,
 * never affects the request that triggered it, no-ops if the org hasn't
 * configured a notification email.
 */
export async function sendOwnerEmail({
  orgId,
  subject,
  html,
}: {
  orgId: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { notificationEmail: true },
    });

    const to = org?.notificationEmail;
    if (!to) return;

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) return;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("Owner email notify failed:", err);
  }
}
