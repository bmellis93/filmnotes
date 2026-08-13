// app/api/shares/create-gallery/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import type { StackMap } from "@/components/domain/stacks";

export const runtime = "nodejs";

function makeToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function safeString(x: unknown) {
  return String(x ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOwnerContext(); // { orgId, userId, role }

    const body = await req.json();

    const galleryId = body.galleryId ? safeString(body.galleryId) : null;
    const title = body.title ? safeString(body.title) : null;

    const allowedVideoIds = Array.isArray(body.allowedVideoIds)
      ? body.allowedVideoIds.map((x: any) => safeString(x)).filter(Boolean)
      : [];

    const stacks = (body.stacks ?? {}) as StackMap;
    const allowComments = body.allowComments !== false;
    const allowDownload = body.allowDownload === true;
    const view = body.view === "VIEW_ONLY" ? "VIEW_ONLY" : "REVIEW_DOWNLOAD";

    if (allowedVideoIds.length === 0) {
      return NextResponse.json(
        { error: "allowedVideoIds is required" },
        { status: 400 }
      );
    }

    // ✅ If galleryId is provided, enforce it belongs to org
    if (galleryId) {
      const gallery = await prisma.gallery.findUnique({
        where: { id: galleryId },
        select: { id: true, orgId: true },
      });

      if (!gallery) {
        return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
      }

      if (gallery.orgId !== ctx.orgId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // ✅ enforce: allowedVideoIds must be in this gallery
      const rows = await prisma.galleryVideo.findMany({
        where: { galleryId },
        select: { videoId: true },
      });

      const galleryVideoSet = new Set(rows.map((r) => r.videoId));
      for (const id of allowedVideoIds) {
        if (!galleryVideoSet.has(id)) {
          return NextResponse.json(
            { error: `Video not in this gallery: ${id}` },
            { status: 400 }
          );
        }
      }
    } else {
      // ✅ If no galleryId, still enforce all videos belong to org
      const vids = await prisma.video.findMany({
        where: { id: { in: allowedVideoIds } },
        select: { id: true, orgId: true },
      });

      if (vids.length !== allowedVideoIds.length) {
        return NextResponse.json(
          { error: "One or more videos not found" },
          { status: 404 }
        );
      }

      for (const v of vids) {
        if (v.orgId !== ctx.orgId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const token = makeToken();

    const share = await prisma.shareLink.create({
      data: {
        orgId: ctx.orgId,
        token,
        galleryId,
        title,
        allowedVideoIdsJson: JSON.stringify(allowedVideoIds),
        stacksJson: JSON.stringify(stacks ?? {}),
        view,
        allowComments,
        allowDownload,
        contactId: body.contactId ? safeString(body.contactId) : null,
        contactName: body.contactName ? safeString(body.contactName) : null,
        conversationId: body.conversationId ? safeString(body.conversationId) : null,
      },
      select: { token: true },
    });

    // ✅ token-mode gallery route you already have: /r/[token]
    return NextResponse.json({
      ok: true,
      token: share.token,
      url: `/r/${share.token}`,
    });
  } catch (err: any) {
    console.error("Create gallery share error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}