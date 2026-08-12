import { NextRequest, NextResponse } from "next/server";
import { requireValidShareToken } from "@/lib/share-auth";
import { prisma } from "@/lib/prisma";
import { parseAllowedIds } from "@/lib/share/shareLinkUtils";
import { sendOwnerWebhook, getOwnerVideoContext, buildOwnerVideoUrl } from "@/lib/notify/sendOwnerWebhook";
import { sanitizeAnnotationInput, parseAnnotationJson } from "@/lib/annotations/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { token, videoId, body, timecodeMs, parentId, annotation } = await req.json();

    const res = await requireValidShareToken(String(token || ""));
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    const share = res.share;

    const orgId = String(share.orgId || "").trim();
    if (!orgId) {
      return NextResponse.json({ error: "Invalid share link (missing orgId)" }, { status: 400 });
    }

    const vid = String(videoId || "").trim();
    if (!vid) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const allowed = parseAllowedIds(share);
    if (!allowed.includes(vid)) {
      return NextResponse.json({ error: "Video not allowed for this link" }, { status: 403 });
    }

    if (!share.allowComments) {
      return NextResponse.json({ error: "Comments disabled for this link" }, { status: 403 });
    }

    const trimmed = String(body || "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Comment body required" }, { status: 400 });
    }

    // ✅ Reply validation (ONLY if parentId provided)
    let parent: { id: string; token: string; videoId: string; orgId: string } | null = null;

    if (parentId) {
      parent = await prisma.comment.findUnique({
        where: { id: String(parentId) },
        select: { id: true, token: true, videoId: true, orgId: true },
      });

      if (!parent) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }

      // Prevent cross-linking across org/token/video
      if (parent.orgId !== orgId || parent.token !== share.token || parent.videoId !== vid) {
        return NextResponse.json({ error: "Invalid parent for this link" }, { status: 403 });
      }
    }

    // Annotations only make sense on the top-level comment that owns the timecode.
    const sanitizedAnnotation = !parent ? sanitizeAnnotationInput(annotation) : null;

    const comment = await prisma.comment.create({
      data: {
        orgId,                 // ✅ REQUIRED now
        token: share.token,    // share token
        videoId: vid,
        timecodeMs: Number(timecodeMs || 0),
        body: trimmed,
        author: null,
        role: "CLIENT",
        parentId: parent ? parent.id : null,
        annotationJson: sanitizedAnnotation ? JSON.stringify(sanitizedAnnotation) : null,
      },
    });

    const { galleryId, title } = await getOwnerVideoContext(vid);
    await sendOwnerWebhook({
      event: "comment",
      orgId,
      videoId: vid,
      videoTitle: title,
      shareToken: share.token,
      ownerUrl: buildOwnerVideoUrl(new URL(req.url).origin, galleryId, vid),
      body: trimmed,
      timecodeMs: Number(timecodeMs || 0),
      occurredAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      comment: { ...comment, annotation: parseAnnotationJson(comment.annotationJson) },
    });
  } catch (err: any) {
    console.error("Create comment error:", err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}