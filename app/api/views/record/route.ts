import { NextRequest, NextResponse } from "next/server";
import { requireValidShareToken } from "@/lib/share-auth";
import { prisma } from "@/lib/prisma";
import { parseAllowedIds } from "@/lib/share/shareLinkUtils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { token, videoId } = await req.json();

    const res = await requireValidShareToken(String(token || ""));
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    const share = res.share;
    const orgId = String(share.orgId || "").trim();
    const vid = String(videoId || "").trim();

    if (!orgId || !vid) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const allowed = parseAllowedIds(share);
    if (!allowed.includes(vid)) {
      return NextResponse.json({ error: "Video not allowed for this link" }, { status: 403 });
    }

    await prisma.videoView.upsert({
      where: { token_videoId: { token: share.token, videoId: vid } },
      create: { orgId, token: share.token, videoId: vid },
      update: { lastViewedAt: new Date(), viewCount: { increment: 1 } },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Best-effort telemetry — never let this block the client from watching the video.
    console.error("Record view error:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
