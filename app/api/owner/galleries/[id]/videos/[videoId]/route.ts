// app/api/owner/galleries/[id]/videos/[videoId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getOwnerVideoReviewData } from "@/lib/owner/videoReviewData";

export const runtime = "nodejs";

// Powers the embed dashboard's video review page
// (app/embed/galleries/[id]/videos/[videoId]) -- the standalone Server
// Component page fetches the same data directly via getOwnerVideoReviewData().
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const owner = await requireOwnerContext();
  const { id, videoId } = await params;
  const galleryId = String(id || "").trim();
  const vId = String(videoId || "").trim();
  if (!galleryId || !vId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const data = await getOwnerVideoReviewData(owner.orgId, galleryId, vId);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
