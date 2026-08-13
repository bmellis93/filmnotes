// app/api/shares/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

function makeToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOwnerContext(); // { orgId, userId, role }

    const body = await req.json();

    const videoId = String(body.videoId || "").trim();
    const allowComments = body.allowComments !== false;
    const allowDownload = body.allowDownload === true;

    const expiresInDays =
      body.expiresInDays !== undefined && body.expiresInDays !== null
        ? Number(body.expiresInDays)
        : null;

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    // ✅ enforce org scope: video must belong to this org
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, orgId: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.orgId !== ctx.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const token = makeToken();

    const expiresAt =
      expiresInDays && !Number.isNaN(expiresInDays)
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const share = await prisma.shareLink.create({
      data: {
        orgId: ctx.orgId,
        token,
        videoId,
        expiresAt,
        allowComments,
        allowDownload,
        view: "REVIEW_DOWNLOAD", // single-video shares default to review+download; tweak if you want
        contactId: body.contactId ? String(body.contactId) : null,
        contactName: body.contactName ? String(body.contactName) : null,
        conversationId: body.conversationId ? String(body.conversationId) : null,
      },
      select: { token: true, videoId: true },
    });

    // ✅ token-mode route you already have: /r/[token]/videos/[videoId]
    return NextResponse.json({
      ok: true,
      token: share.token,
      url: `/r/${share.token}/videos/${share.videoId}`,
    });
  } catch (err: any) {
    console.error("Create share error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}