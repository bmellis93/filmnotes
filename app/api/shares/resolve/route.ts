// app/api/shares/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const t = String(token || "").trim();

    if (!t) return NextResponse.json({ error: "token required" }, { status: 400 });

    const share = await prisma.shareLink.findUnique({
      where: { token: t },
      select: {
        token: true,
        videoId: true,
        galleryId: true,
        title: true,
        view: true,
        allowComments: true,
        allowDownload: true,
        allowedVideoIdsJson: true,
        stacksJson: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (share.revokedAt) {
      return NextResponse.json({ error: "Revoked" }, { status: 410 });
    }

    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Expired" }, { status: 410 });
    }

    return NextResponse.json({
      ok: true,
      token: share.token,
      videoId: share.videoId,
      galleryId: share.galleryId,
      title: share.title,
      view: share.view,
      allowComments: share.allowComments,
      allowDownload: share.allowDownload,
      allowedVideoIdsJson: share.allowedVideoIdsJson,
      stacksJson: share.stacksJson,
      expiresAt: share.expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}