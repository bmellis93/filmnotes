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

    const expiresAt =
      expiresInDays && !Number.isNaN(expiresInDays)
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const contactId = body.contactId ? String(body.contactId) : null;
    const contactName = body.contactName ? String(body.contactName) : null;
    const conversationId = body.conversationId ? String(body.conversationId) : null;

    // Resending to the same contact for the same video reuses their existing
    // link (refreshing settings/expiry) instead of piling up a new row every
    // send -- only meaningful when there's a contact to key the match on.
    if (contactId) {
      const existing = await prisma.shareLink.findFirst({
        where: { orgId: ctx.orgId, videoId, contactId },
        select: { id: true, token: true, videoId: true },
      });

      if (existing) {
        const updated = await prisma.shareLink.update({
          where: { id: existing.id },
          data: { expiresAt, allowComments, allowDownload, contactName, conversationId },
          select: { token: true, videoId: true },
        });

        return NextResponse.json({
          ok: true,
          token: updated.token,
          url: `/r/${updated.token}/videos/${updated.videoId}`,
          reused: true,
        });
      }
    }

    const share = await prisma.shareLink.create({
      data: {
        orgId: ctx.orgId,
        token: makeToken(),
        videoId,
        expiresAt,
        allowComments,
        allowDownload,
        view: "REVIEW_DOWNLOAD", // single-video shares default to review+download; tweak if you want
        contactId,
        contactName,
        conversationId,
      },
      select: { token: true, videoId: true },
    });

    // ✅ token-mode route you already have: /r/[token]/videos/[videoId]
    return NextResponse.json({
      ok: true,
      token: share.token,
      url: `/r/${share.token}/videos/${share.videoId}`,
      reused: false,
    });
  } catch (err: any) {
    console.error("Create share error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}