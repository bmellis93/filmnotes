import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGhlAccessToken } from "@/lib/ghl/client";
import { sendGhlMessage } from "@/lib/ghl/sendMessage";

export const runtime = "nodejs";

const NUDGE_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3 days, once only

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";

  const now = new Date();
  const cutoff = new Date(now.getTime() - NUDGE_AFTER_MS);
  const origin = new URL(req.url).origin;

  const candidates = await prisma.shareLink.findMany({
    where: {
      contactId: { not: null },
      nudgedAt: null,
      createdAt: { lte: cutoff },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      orgId: true,
      token: true,
      title: true,
      contactId: true,
    },
  });

  let nudged = 0;
  let skippedViewed = 0;
  let failed = 0;

  const tokenCache = new Map<string, string>();

  for (const share of candidates) {
    try {
      const alreadyViewed = await prisma.videoView.findFirst({
        where: { token: share.token },
        select: { id: true },
      });

      if (alreadyViewed) {
        // Nothing more to do for this link -- mark it settled so it stops
        // showing up in this query every day.
        if (!dryRun) await prisma.shareLink.update({ where: { id: share.id }, data: { nudgedAt: now } });
        skippedViewed++;
        continue;
      }

      if (dryRun) {
        nudged++;
        continue;
      }

      let accessToken = tokenCache.get(share.orgId);
      if (!accessToken) {
        accessToken = await getGhlAccessToken(share.orgId);
        tokenCache.set(share.orgId, accessToken);
      }

      const label = share.title || "your video";
      const link = `${origin}/r/${share.token}`;
      const message = `Hi! Just a friendly reminder — ${label} is ready for your review: ${link}`;

      const { sent } = await sendGhlMessage({
        accessToken,
        orgId: share.orgId,
        contactId: share.contactId!,
        message,
        subject: `Reminder: ${label} is ready for review`,
      });

      if (sent.length) {
        await prisma.shareLink.update({ where: { id: share.id }, data: { nudgedAt: now } });
        nudged++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error("Nudge failed for share", share.id, err);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    checked: candidates.length,
    nudged,
    skippedViewed,
    failed,
  });
}
