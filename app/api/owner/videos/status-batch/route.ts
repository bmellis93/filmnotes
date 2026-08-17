import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import {
  normalizeString,
  normalizeStatus,
  normalizeIsoDate,
  normalizeBytesToNumber,
  normalizeBytesToString
} from "@/app/api/owner/videos/_shared/videoPayload";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const owner = await requireOwnerContext();
  requireRole(owner, "VIEWER");

  const body = (await req.json().catch(() => ({}))) as { videoIds?: string[] };
  const raw = Array.isArray(body.videoIds) ? body.videoIds.map(String) : [];

  // ✅ server-side safety net: ignore temp ids, dedupe, cap
  const ids = Array.from(
    new Set(raw.filter((id) => id && !id.startsWith("temp_")))
  ).slice(0, 200);

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, videos: [] });
  }

  const videos = await prisma.video.findMany({
    where: {
      id: { in: ids },
      orgId: owner.orgId,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
      thumbnailUrl: true,
      playbackUrl: true,
      title: true,
      description: true,
      archivedAt: true,
      originalSize: true,
      createdAt: true,
      failureReason: true,
    },
  });

  return NextResponse.json({
    ok: true,
    videos: videos.map((v) => ({
      id: v.id,
      status: normalizeStatus(v.status),
      thumbnailUrl: normalizeString(v.thumbnailUrl),
      playbackUrl: normalizeString(v.playbackUrl),
      title: normalizeString(v.title),
      description: normalizeString(v.description),
      archivedAt: normalizeIsoDate(v.archivedAt),
      createdAt: normalizeIsoDate(v.createdAt),
      failureReason: normalizeString(v.failureReason),
      originalSize: normalizeBytesToNumber(v.originalSize),
      originalSizeLabel: normalizeBytesToString(v.originalSize),
    })),
  });
}