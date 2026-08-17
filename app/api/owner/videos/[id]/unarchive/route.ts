import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireOwnerContext();
  requireRole(owner, "CONTRIBUTOR");
  const { id } = await params;
  const videoId = String(id || "").trim();

  await prisma.video.updateMany({
    where: {
      id: videoId,
      orgId: owner.orgId,
      deletedAt: null,
    },
    data: { archivedAt: null },
  });

  return NextResponse.json({ ok: true });
}