import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { sanitizeAnnotationInput, parseAnnotationJson } from "@/lib/annotations/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOwnerContext(); // ✅ await (ctx is OwnerContext now)

    const { videoId, body, timecodeMs, parentId, annotation } = await req.json();

    const vid = String(videoId || "").trim();
    if (!vid) return NextResponse.json({ error: "videoId is required" }, { status: 400 });

    const trimmed = String(body || "").trim();
    if (!trimmed) return NextResponse.json({ error: "Comment body required" }, { status: 400 });

    // ✅ enforce org scope
    const video = await prisma.video.findUnique({
      where: { id: vid },
      select: { id: true, orgId: true },
    });

    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (video.orgId !== ctx.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // ✅ Reply validation (same org + same video)
    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: String(parentId) },
        select: { id: true, videoId: true, orgId: true },
      });

      if (!parent) return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      if (parent.videoId !== vid || parent.orgId !== ctx.orgId) {
        return NextResponse.json({ error: "Invalid parent for this org/video" }, { status: 403 });
      }
    }

    // Annotations only make sense on the top-level comment that owns the timecode.
    const sanitizedAnnotation = !parentId ? sanitizeAnnotationInput(annotation) : null;

    const comment = await prisma.comment.create({
      data: {
        orgId: ctx.orgId,
        token: `OWNER:${ctx.orgId}`, // ✅ required string; keeps owner comments distinct
        videoId: vid,
        timecodeMs: Number(timecodeMs || 0),
        body: trimmed,
        author: null, // or store ctx.userId/name if you want
        role: "OWNER",
        parentId: parentId ? String(parentId) : null,
        annotationJson: sanitizedAnnotation ? JSON.stringify(sanitizedAnnotation) : null,
      },
      select: {
        id: true,
        timecodeMs: true,
        body: true,
        author: true,
        createdAt: true,
        parentId: true,
        role: true,
        status: true,
        annotationJson: true,
      },
    });

    return NextResponse.json({
      ok: true,
      comment: { ...comment, annotation: parseAnnotationJson(comment.annotationJson) },
    });
  } catch (err: any) {
    console.error("create-owner error:", err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}