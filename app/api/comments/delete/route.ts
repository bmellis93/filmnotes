// app/api/comments/delete/route.ts
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
      select: { id: true, orgId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existing.orgId !== ctx.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Replies cascade-delete via the Comment.parent relation's onDelete: Cascade.
    await prisma.comment.delete({ where: { id: cid } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("delete comment error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}
