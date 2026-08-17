// app/api/owner/galleries/route.ts
import { NextResponse } from "next/server";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { getOwnerGalleriesList } from "@/lib/owner/galleriesData";

export const runtime = "nodejs";

// Powers the embed dashboard's galleries list (app/embed/galleries) --
// the standalone Server Component page fetches the same data directly via
// getOwnerGalleriesList() since it doesn't need a round trip through here.
export async function GET() {
  const owner = await requireOwnerContext();
  requireRole(owner, "VIEWER");
  const galleries = await getOwnerGalleriesList(owner.orgId);
  return NextResponse.json({ galleries });
}
