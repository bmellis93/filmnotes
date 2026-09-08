// app/api/owner/videos/[id]/update-details/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const owner = await requireOwnerContext();
    requireRole(owner, "UPLOADER");
    const { id } = await params;
    const videoId = String(id || "").trim();

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim();

    if (!title) {
      return NextResponse.json({ ok: false, error: "Missing title" }, { status: 400 });
    }

    const video = await prisma.video.findFirst({
      where: { id: videoId, orgId: owner.orgId, deletedAt: null },
      select: { id: true },
    });

    if (!video) {
      return NextResponse.json({ ok: false, error: "Video not found" }, { status: 404 });
    }

    const updated = await prisma.video.update({
      where: { id: videoId },
      data: { title, description: description || null },
      select: { title: true, description: true },
    });

    return NextResponse.json({
      ok: true,
      title: updated.title,
      description: updated.description ?? "",
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Update failed" },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}
