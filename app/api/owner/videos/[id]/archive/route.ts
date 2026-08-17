// app/api/owner/videos/[id]/archive/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireOwnerContext();
  requireRole(owner, "CONTRIBUTOR");
  const { id } = await params;
  const videoId = String(id || "").trim();

  // Verify video belongs to org
  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      orgId: owner.orgId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  await prisma.video.update({
    where: { id: videoId },
    data: { archivedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}