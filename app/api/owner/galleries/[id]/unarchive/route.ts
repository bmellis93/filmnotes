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
  const galleryId = String(id || "").trim();

  const gallery = await prisma.gallery.findFirst({
    where: { id: galleryId, orgId: owner.orgId },
    select: { id: true },
  });

  if (!gallery) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.gallery.update({
      where: { id: galleryId },
      data: { archivedAt: null },
    }),

    prisma.video.updateMany({
      where: {
        galleryVideos: {
          some: { galleryId },
        },
        deletedAt: null,
      },
      data: { archivedAt: null },
    }),
  ]);

  return NextResponse.json({ ok: true });
}