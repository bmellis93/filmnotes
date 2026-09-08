// app/api/owner/galleries/[id]/update/route.ts
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
    requireRole(owner, "CONTRIBUTOR");
    const { id } = await params;
    const galleryId = String(id || "").trim();

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();

    if (!name) {
      return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
    }

    const gallery = await prisma.gallery.findFirst({
      where: { id: galleryId, orgId: owner.orgId, deletedAt: null },
      select: { id: true },
    });

    if (!gallery) {
      return NextResponse.json({ ok: false, error: "Gallery not found" }, { status: 404 });
    }

    const updated = await prisma.gallery.update({
      where: { id: galleryId },
      data: { title: name, description: description || null },
      select: { id: true, title: true, description: true },
    });

    return NextResponse.json({
      ok: true,
      gallery: {
        id: updated.id,
        name: updated.title ?? "Untitled gallery",
        description: updated.description ?? "",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Update failed" },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}
