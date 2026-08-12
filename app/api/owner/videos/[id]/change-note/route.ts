// app/api/owner/videos/[id]/change-note/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireOwnerContext();
  const { id } = await params;
  const videoId = String(id || "").trim();

  const body = await req.json().catch(() => ({}));
  const note = String(body.note ?? "").trim();

  const video = await prisma.video.findFirst({
    where: { id: videoId, orgId: owner.orgId, deletedAt: null },
    select: { id: true },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const updated = await prisma.video.update({
    where: { id: videoId },
    data: { changeNote: note || null },
    select: { changeNote: true },
  });

  return NextResponse.json({ ok: true, changeNote: updated.changeNote });
}
