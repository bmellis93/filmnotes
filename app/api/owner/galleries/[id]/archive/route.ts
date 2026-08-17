import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const owner = await requireOwnerContext();
    requireRole(owner, "CONTRIBUTOR");

    const { id } = await params;
    const galleryId = String(id || "").trim();

    if (!galleryId) {
      return NextResponse.json({ error: "Missing gallery id" }, { status: 400 });
    }

    // ensure belongs to org + not deleted
    const gallery = await prisma.gallery.findFirst({
      where: { id: galleryId, orgId: owner.orgId, deletedAt: null },
      select: { id: true },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    await prisma.gallery.update({
      where: { id: galleryId },
      data: { archivedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}