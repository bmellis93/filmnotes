import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "VIEWER");
    const { orgId } = ctx;
    const galleryId = req.nextUrl.searchParams.get("galleryId");

    if (!galleryId) {
      return NextResponse.json({ error: "galleryId is required" }, { status: 400 });
    }

    const gallery = await prisma.gallery.findFirst({
      where: { id: galleryId, orgId, deletedAt: null },
      select: { id: true },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    const galleryVideos = await prisma.galleryVideo.findMany({
      where: { galleryId },
      select: { videoId: true },
    });
    const videoIds = galleryVideos.map((g) => g.videoId);

    // Every share link tied to this gallery: gallery-wide links (galleryId
    // set) plus single-video links for any video that lives in this gallery.
    const shares = await prisma.shareLink.findMany({
      where: {
        orgId,
        OR: [{ galleryId }, ...(videoIds.length ? [{ videoId: { in: videoIds } }] : [])],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        videoId: true,
        galleryId: true,
        title: true,
        view: true,
        allowComments: true,
        allowDownload: true,
        createdAt: true,
        expiresAt: true,
        contactName: true,
      },
    });

    const videoTitles = videoIds.length
      ? await prisma.video.findMany({
          where: { id: { in: videoIds } },
          select: { id: true, title: true },
        })
      : [];
    const titleById = new Map(videoTitles.map((v) => [v.id, v.title]));

    const rows = shares.map((s) => ({
      id: s.id,
      token: s.token,
      kind: s.videoId ? ("video" as const) : ("gallery" as const),
      label: s.videoId ? (titleById.get(s.videoId) ?? "Video") : (s.title ?? "Gallery"),
      view: s.view,
      allowComments: s.allowComments,
      allowDownload: s.allowDownload,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      contactName: s.contactName,
      url: s.videoId ? `/r/${s.token}/videos/${s.videoId}` : `/r/${s.token}`,
    }));

    return NextResponse.json({ ok: true, shares: rows });
  } catch (err: any) {
    console.error("List shares error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}
