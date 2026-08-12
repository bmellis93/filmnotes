import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { parseAnnotationJson } from "@/lib/annotations/types";

export const runtime = "nodejs";

type FlatComment = {
  id: string;
  orgId: string;
  token: string; // owner comments will be "OWNER" if you chose option A
  videoId: string;
  timecodeMs: number;
  body: string;
  author: string | null;
  role: "OWNER" | "CLIENT";
  status: "OPEN" | "RESOLVED";
  createdAt: Date;
  parentId: string | null;
  isApprovalNote: boolean;
  annotationJson: string | null;
};

function toThreaded(comments: FlatComment[]) {
  const byId = new Map<string, any>();
  const roots: any[] = [];

  for (const c of comments) {
    byId.set(c.id, {
      id: c.id,
      timecodeMs: c.timecodeMs,
      body: c.body,
      author: c.author,
      createdAt: c.createdAt.toISOString(),
      parentId: c.parentId,
      replies: [],
      role: c.role,
      status: c.status,
      isApprovalNote: c.isApprovalNote,
      annotation: parseAnnotationJson(c.annotationJson),
    });
  }

  for (const c of comments) {
    const node = byId.get(c.id);
    if (!c.parentId) {
      roots.push(node);
      continue;
    }

    const parent = byId.get(c.parentId);
    if (parent) parent.replies.push(node);
    else roots.push(node); // orphan safety -> root
  }

  return roots;
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOwnerContext(); // { orgId, userId, role }

    const { videoId } = await req.json();

    const vid = String(videoId || "").trim();
    if (!vid) {
      return NextResponse.json({ error: "videoId required" }, { status: 400 });
    }

    // ✅ Enforce org scope by verifying the video belongs to this org
    const video = await prisma.video.findUnique({
      where: { id: vid },
      select: { id: true, orgId: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.orgId !== ctx.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ✅ Fetch all comments for this video within the org (owner sees OWNER + CLIENT)
    const flat = await prisma.comment.findMany({
      where: {
        orgId: ctx.orgId,
        videoId: vid,
      },
      orderBy: [{ timecodeMs: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        orgId: true,
        token: true,
        videoId: true,
        timecodeMs: true,
        body: true,
        author: true,
        role: true,
        status: true,
        createdAt: true,
        parentId: true,
        isApprovalNote: true,
        annotationJson: true,
      },
    });

    const comments = toThreaded(flat as FlatComment[]);

    return NextResponse.json({ ok: true, comments });
  } catch (err: any) {
    console.error("list-owner error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}