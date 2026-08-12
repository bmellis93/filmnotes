import "server-only";
import { prisma } from "@/lib/prisma";

export type ViewSummary = {
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
};

/** Aggregates view receipts across every share link for a single video. */
export async function getViewSummaryForVideo(videoId: string): Promise<ViewSummary | null> {
  const rows = await prisma.videoView.findMany({
    where: { videoId },
    select: { firstViewedAt: true, lastViewedAt: true, viewCount: true },
  });

  if (rows.length === 0) return null;

  return rows.reduce<ViewSummary>(
    (acc, r) => ({
      firstViewedAt: r.firstViewedAt < new Date(acc.firstViewedAt) ? r.firstViewedAt.toISOString() : acc.firstViewedAt,
      lastViewedAt: r.lastViewedAt > new Date(acc.lastViewedAt) ? r.lastViewedAt.toISOString() : acc.lastViewedAt,
      viewCount: acc.viewCount + r.viewCount,
    }),
    { firstViewedAt: rows[0].firstViewedAt.toISOString(), lastViewedAt: rows[0].lastViewedAt.toISOString(), viewCount: 0 }
  );
}

/** Aggregates view receipts across every share link, grouped by video, for a set of videos (e.g. a gallery grid). */
export async function getViewSummariesForVideos(videoIds: string[]): Promise<Map<string, ViewSummary>> {
  if (videoIds.length === 0) return new Map();

  const rows = await prisma.videoView.findMany({
    where: { videoId: { in: videoIds } },
    select: { videoId: true, firstViewedAt: true, lastViewedAt: true, viewCount: true },
  });

  const byVideo = new Map<string, ViewSummary>();

  for (const r of rows) {
    const existing = byVideo.get(r.videoId);
    if (!existing) {
      byVideo.set(r.videoId, {
        firstViewedAt: r.firstViewedAt.toISOString(),
        lastViewedAt: r.lastViewedAt.toISOString(),
        viewCount: r.viewCount,
      });
      continue;
    }

    byVideo.set(r.videoId, {
      firstViewedAt: r.firstViewedAt < new Date(existing.firstViewedAt) ? r.firstViewedAt.toISOString() : existing.firstViewedAt,
      lastViewedAt: r.lastViewedAt > new Date(existing.lastViewedAt) ? r.lastViewedAt.toISOString() : existing.lastViewedAt,
      viewCount: existing.viewCount + r.viewCount,
    });
  }

  return byVideo;
}
