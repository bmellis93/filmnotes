// app/api/owner/galleries/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { getOwnerGalleryDetail } from "@/lib/owner/galleryDetailData";

export const runtime = "nodejs";

// Powers the embed dashboard's gallery detail page
// (app/embed/galleries/[id]) -- the standalone Server Component page
// fetches the same data directly via getOwnerGalleryDetail().
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwnerContext();
  requireRole(owner, "VIEWER");
  const { id } = await params;
  const galleryId = String(id || "").trim();
  if (!galleryId) {
    return NextResponse.json({ error: "Missing gallery id" }, { status: 400 });
  }

  const detail = await getOwnerGalleryDetail(owner.orgId, galleryId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
