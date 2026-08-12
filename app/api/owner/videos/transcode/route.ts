// app/api/videos/transcode/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { signR2GetUrl } from "@/lib/r2Signed";
import { getR2SignedUrlTtlSeconds } from "@/lib/r2";
import { mux } from "@/lib/mux";

export const runtime = "nodejs";

type Body = {
  videoId: string;
};

export async function POST(req: Request) {
  try {
    const owner = await requireOwnerContext();
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const videoId = String(body.videoId || "").trim();
    if (!videoId) {
      return NextResponse.json({ ok: false, error: "Missing videoId" }, { status: 400 });
    }

    // 1) Load the video, enforce org scope
    const video = await prisma.video.findFirst({
      where: { id: videoId, orgId: owner.orgId },
      select: { id: true, orgId: true, originalKey: true, muxAssetId: true },
    });

    if (!video) {
      return NextResponse.json({ ok: false, error: "Video not found" }, { status: 404 });
    }
    if (!video.originalKey) {
      return NextResponse.json({ ok: false, error: "Video missing originalKey" }, { status: 400 });
    }

    // Optional: prevent re-transcoding if already created
    if (video.muxAssetId) {
      return NextResponse.json({ ok: true, muxAssetId: video.muxAssetId, already: true });
    }

    // 2) Sign a GET URL so Mux can fetch the original from R2
    const expiresIn = getR2SignedUrlTtlSeconds();

    const inputUrl = await signR2GetUrl(video.originalKey, expiresIn);

    // 3) Create Mux asset (HLS playback).
    // Two playback IDs: "signed" is used for the actual video stream (token
    // required, short-lived, refreshed silently by the player), "public" is
    // used only for thumbnails/gifs, which don't need to be protected.
    const asset = await mux.video.assets.create({
      inputs: [{ url: inputUrl }],
      playback_policy: ["signed", "public"],
    });

    // 4) Persist muxAssetId and mark processing
    await prisma.video.update({
      where: { id: video.id },
      data: {
        muxAssetId: asset.id,
        status: "PROCESSING",
      },
    });

    return NextResponse.json({ ok: true, muxAssetId: asset.id });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err?.message ?? "Transcode failed" }, { status: 500 });
  }
}