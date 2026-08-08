import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signR2GetUrl } from "@/lib/r2Signed";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getShareContextFromRequest } from "@/lib/auth/shareContext"; // token helper

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // -----------------------------
  // 1) Fetch video + originalKey (unscoped -- permission check happens below,
  //    since this endpoint serves both owner and share-token requests)
  // -----------------------------
  const video = await prisma.video.findUnique({
    where: { id },
    select: {
      id: true,
      orgId: true,
      originalKey: true,
      originalName: true,
    },
  });

  if (!video || !video.originalKey) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // -----------------------------
  // 2) Permission check
  // -----------------------------
  let allowed = false;

  // Owner access
  try {
    const owner = await requireOwnerContext();
    if (owner.orgId === video.orgId) {
      allowed = true;
    }
  } catch {
    // not an owner session, fall through to share-token check
  }

  // Share-token access (only if not owner), respecting the link's download permission
  if (!allowed) {
    const share = await getShareContextFromRequest(req);
    if (
      share &&
      share.orgId === video.orgId &&
      share.videoIds.includes(id) &&
      share.allowDownload
    ) {
      allowed = true;
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // -----------------------------
  // 3) Signed R2 GET + redirect
  // -----------------------------
  const signedUrl = await signR2GetUrl(
    video.originalKey,
    60, // seconds (short-lived)
    video.originalName ?? undefined
  );

  return NextResponse.redirect(signedUrl);
}