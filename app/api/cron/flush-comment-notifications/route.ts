import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flushPendingCommentNotifications } from "@/lib/notify/flushCommentNotifications";

export const runtime = "nodejs";

// Safety net for the client-side debounce/browse-away path (tab killed,
// fetch(keepalive) failed, etc.) -- runs daily, so this window just needs to
// comfortably cover "since yesterday's run"; anything older would already
// have been flushed by an earlier run or the client itself.
const LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000;

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
  const origin = new URL(req.url).origin;
  const since = new Date(Date.now() - LOOKBACK_MS);

  const candidates = await prisma.comment.groupBy({
    by: ["videoId"],
    where: { role: "CLIENT", createdAt: { gte: since } },
    _max: { createdAt: true },
  });

  let flushed = 0;
  let skipped = 0;
  let failed = 0;
  const results: Array<{ videoId: string; flushed?: boolean; error?: string }> = [];

  for (const c of candidates) {
    const newestComment = c._max.createdAt;
    if (!newestComment) continue;

    try {
      const video = await prisma.video.findUnique({
        where: { id: c.videoId },
        select: { commentsNotifiedThroughAt: true },
      });
      if (!video) continue;

      // Prisma can't compare two columns across rows in a `where` -- same
      // constraint already noted in bill-storage-overage/route.ts.
      if (video.commentsNotifiedThroughAt && video.commentsNotifiedThroughAt >= newestComment) {
        skipped++;
        continue;
      }

      if (dryRun) {
        flushed++;
        results.push({ videoId: c.videoId, flushed: true });
        continue;
      }

      await flushPendingCommentNotifications(c.videoId, origin);
      flushed++;
      results.push({ videoId: c.videoId, flushed: true });
    } catch (err: any) {
      console.error("Flush comment notifications failed for video", c.videoId, err);
      failed++;
      results.push({ videoId: c.videoId, error: err?.message ?? String(err) });
    }
  }

  return NextResponse.json({ ok: true, dryRun, flushed, skipped, failed, results });
}
