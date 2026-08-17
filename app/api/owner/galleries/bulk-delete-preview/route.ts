import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const owner = await requireOwnerContext();
  requireRole(owner, "VIEWER");
  const body = (await req.json().catch(() => ({}))) as { galleryIds?: string[] };

  const galleryIds = Array.isArray(body.galleryIds) ? body.galleryIds.map(String) : [];
  if (galleryIds.length === 0) {
    return NextResponse.json({ error: "galleryIds required" }, { status: 400 });
  }

  // Sum bytes for videos in these galleries, but count each video once.
  const rows = await prisma.galleryVideo.findMany({
    where: {
      galleryId: { in: galleryIds },
      gallery: { orgId: owner.orgId, deletedAt: null },
      video: { deletedAt: null },
    },
    select: { videoId: true, video: { select: { originalSize: true } } },
  });

  const seen = new Set<string>();
  let bytes = BigInt(0);

  for (const r of rows) {
    if (seen.has(r.videoId)) continue;
    seen.add(r.videoId);
    bytes += BigInt(r.video.originalSize ?? 0);
  }

  const totalGb = (() => {
    const gb = Number(bytes) / (1024 * 1024 * 1024);
    return gb >= 10 ? gb.toFixed(0) : gb.toFixed(1);
  })();

  return NextResponse.json({
    ok: true,
    bytes: bytes.toString(),
    totalGb,
  });
}