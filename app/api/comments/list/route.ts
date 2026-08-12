import { NextRequest, NextResponse } from "next/server";
import { requireValidShareToken } from "@/lib/share-auth";
import { prisma } from "@/lib/prisma";
import { parseAllowedIds } from "@/lib/share/shareLinkUtils";
import { parseAnnotationJson } from "@/lib/annotations/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { token, videoId } = await req.json();

    const res = await requireValidShareToken(String(token || ""));
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

    const share = res.share;
    const allowed = parseAllowedIds(share);

    const vid = String(videoId || "").trim();
    if (!vid) return NextResponse.json({ error: "videoId is required" }, { status: 400 });

    if (!allowed.includes(vid)) {
      return NextResponse.json({ error: "Video not allowed for this link" }, { status: 403 });
    }

    const rows = await prisma.comment.findMany({
      where: {
        orgId: share.orgId,          // ✅ enforce org scope
        token: share.token,
        videoId: vid,
      },
      orderBy: [{ timecodeMs: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        timecodeMs: true,
        body: true,
        author: true,
        createdAt: true,
        parentId: true,
        role: true,
        status: true,               // ✅ optional but useful
        isApprovalNote: true,
        annotationJson: true,
      },
    });

    const byId = new Map<string, any>();

    for (const r of rows) {
      byId.set(r.id, {
        id: r.id,
        timecodeMs: r.timecodeMs,
        body: r.body,
        author: r.author,
        createdAt: r.createdAt.toISOString(),
        parentId: r.parentId,
        role: r.role,
        status: r.status,
        isApprovalNote: r.isApprovalNote,
        annotation: parseAnnotationJson(r.annotationJson),
        replies: [],
      });
    }

    const roots: any[] = [];

    for (const r of rows) {
      const node = byId.get(r.id)!;

      if (r.parentId) {
        const parent = byId.get(r.parentId);
        if (parent) parent.replies.push(node);
        else roots.push(node); // parent missing (shouldn't happen, but safe)
      } else {
        roots.push(node);
      }
    }

    return NextResponse.json({ ok: true, comments: roots });
  } catch (err: any) {
    console.error("LIST COMMENTS ERROR:", err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}