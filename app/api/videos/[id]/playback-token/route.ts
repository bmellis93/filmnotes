import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mux } from "@/lib/mux";
import { resolveVideoAccess } from "@/lib/auth/videoAccess";

export const runtime = "nodejs";

// Short-lived on purpose -- a copied URL should stop working soon after.
// The player refreshes silently in the background well before this expires.
const TOKEN_TTL_SECONDS = 4 * 60 * 60; // 4 hours

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Viewing doesn't require the share link's "Allow downloads" permission --
  // only actually downloading the original file does.
  const access = await resolveVideoAccess(req, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const video = await prisma.video.findUnique({
    where: { id },
    select: { muxPlaybackId: true, status: true },
  });

  if (!video?.muxPlaybackId) {
    return NextResponse.json({ error: "Video not ready" }, { status: 404 });
  }

  const token = await mux.jwt.signPlaybackId(video.muxPlaybackId, {
    expiration: `${TOKEN_TTL_SECONDS}s`,
  });

  return NextResponse.json({
    playbackId: video.muxPlaybackId,
    token,
    expiresInSeconds: TOKEN_TTL_SECONDS,
  });
}
