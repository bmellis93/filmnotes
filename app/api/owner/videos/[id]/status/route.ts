// app/api/videos/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { getShareContextFromRequest } from "@/lib/auth/shareContext";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    // ✅ Fetch video first (include orgId so we can authorize)
    const video = await prisma.video.findFirst({
      where: { id },
      select: {
        id: true,
        orgId: true, // ✅ add this
        title: true,
        description: true,
        status: true,
        thumbnailUrl: true,
        playbackUrl: true,
        muxPlaybackId: true,
      },
    });

    if (!video) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // ✅ Allow either:
    // - owner of the org
    // - valid share token that includes this video
    let allowed = false;

    try {
      const owner = await requireOwnerContext();
      requireRole(owner, "VIEWER");
      if (owner?.orgId === video.orgId) allowed = true;
    } catch {
      // ignore (not owner)
    }

    if (!allowed) {
      const share = await getShareContextFromRequest(req);
      if (share && share.orgId === video.orgId && share.videoIds.includes(id)) {
        allowed = true;
      }
    }

    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    // ✅ Normalize status for UI
    const normalizedStatus =
      video.status === "READY"
        ? "READY"
        : video.status === "FAILED"
        ? "FAILED"
        : video.status === "UPLOADED"
        ? "UPLOADED"
        : "PROCESSING";

    // (optional) fallback thumb if DB isn't set yet
    const fallbackThumb = video.muxPlaybackId
      ? `https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg?time=5`
      : null;

    return NextResponse.json({
      ok: true,
      status: normalizedStatus,
      thumbnailUrl: video.thumbnailUrl ?? fallbackThumb,
      playbackUrl: video.playbackUrl ?? null,
      title: video.title ?? null,
      description: video.description ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Server error" },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}