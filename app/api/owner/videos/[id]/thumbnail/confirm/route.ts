import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getR2PublicBaseUrl } from "@/lib/r2";
import { deleteFromR2Public } from "@/lib/r2Delete";

export const runtime = "nodejs";

function s(x: unknown) {
  return String(x ?? "").trim();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireOwnerContext();
  const { id } = await params;
  const videoId = String(id || "").trim();

  const video = await prisma.video.findFirst({
    where: { id: videoId, orgId: owner.orgId, deletedAt: null },
    select: { id: true, thumbnailKey: true, thumbnailIsCustom: true },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "Video not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({} as any));
  const key = s(body.key);

  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing key" }, { status: 400 });
  }

  const publicUrl = `${getR2PublicBaseUrl()}/${key}`;

  // Clean up a previously uploaded custom thumbnail, if this replaces one.
  if (video.thumbnailIsCustom && video.thumbnailKey && video.thumbnailKey !== key) {
    try {
      await deleteFromR2Public(video.thumbnailKey);
    } catch {}
  }

  await prisma.video.update({
    where: { id: video.id },
    data: {
      thumbnailKey: key,
      thumbnailUrl: publicUrl,
      thumbnailIsCustom: true,
    },
  });

  return NextResponse.json({ ok: true, thumbnailUrl: publicUrl });
}
