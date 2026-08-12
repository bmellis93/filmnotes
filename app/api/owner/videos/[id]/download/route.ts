import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signR2GetUrl } from "@/lib/r2Signed";
import { resolveVideoAccess } from "@/lib/auth/videoAccess";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const access = await resolveVideoAccess(req, id, { requireAllowDownload: true });
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const video = await prisma.video.findUnique({
    where: { id },
    select: { originalKey: true, originalName: true },
  });

  if (!video || !video.originalKey) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const signedUrl = await signR2GetUrl(
    video.originalKey,
    60, // seconds (short-lived)
    video.originalName ?? undefined
  );

  return NextResponse.redirect(signedUrl);
}
