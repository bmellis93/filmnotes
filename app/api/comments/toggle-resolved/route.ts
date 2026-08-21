// app/api/comments/toggle-resolved/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOwnerContext(); // { orgId, userId, role }
    requireRole(ctx, "CONTRIBUTOR");

    const { commentId } = await req.json();

    const cid = String(commentId || "").trim();
    if (!cid) {
      return NextResponse.json({ error: "commentId required" }, { status: 400 });
    }

    // ✅ load the comment + enforce org scope
    const existing = await prisma.comment.findUnique({
      where: { id: cid },
      select: { id: true, orgId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existing.orgId !== ctx.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextStatus = existing.status === "OPEN" ? "RESOLVED" : "OPEN";

    const updated = await prisma.comment.update({
      where: { id: cid },
      data: { status: nextStatus },
      select: {
        id: true,
        orgId: true,
        videoId: true,
        timecodeMs: true,
        body: true,
        author: true,
        role: true,
        status: true,
        createdAt: true,
        parentId: true,
      },
    });

    return NextResponse.json({ ok: true, comment: updated });
  } catch (err: any) {
    console.error("toggle-resolved error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}