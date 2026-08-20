// app/api/videos/[id]/transcode/route.ts
import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

function getIdFromPath(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("videos");
  return i >= 0 ? parts[i + 1] ?? null : null;
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOwnerContext(); // { orgId, userId, role }
    requireRole(ctx, "UPLOADER");

    const videoId = getIdFromPath(req);
    if (!videoId) {
      return NextResponse.json(
        { error: "Missing video id in route path" },
        { status: 400 }
      );
    }

    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;
    if (!tokenId || !tokenSecret) {
      return NextResponse.json(
        { error: "Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET" },
        { status: 500 }
      );
    }

    const mux = new Mux({ tokenId, tokenSecret });

    // ✅ Enforce org ownership
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, orgId: true, sourceUrl: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.orgId !== ctx.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!video.sourceUrl) {
      return NextResponse.json(
        { error: "Video has no sourceUrl" },
        { status: 400 }
      );
    }

    const asset = await mux.video.assets.create({
      inputs: [{ url: video.sourceUrl }],
      playback_policy: ["public"],
      max_resolution_tier: "2160p",
    });

    const playbackId = asset.playback_ids?.[0]?.id ?? null;
    const playbackUrl = playbackId
      ? `https://stream.mux.com/${playbackId}.m3u8`
      : null;

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "PROCESSING",
        muxAssetId: asset.id,
        muxPlaybackId: playbackId,
        playbackUrl,
      },
    });

    return NextResponse.json({
      ok: true,
      videoId,
      muxAssetId: asset.id,
      muxPlaybackId: playbackId,
    });
  } catch (err: any) {
    console.error("TRANSCODE ROUTE ERROR:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}