import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

const STORAGE_LIMIT_BYTES = 100 * 1024 * 1024 * 1024; // 100GB (number, no bigint literals)

export async function GET() {
  const owner = await requireOwnerContext();
  requireRole(owner, "VIEWER");

  // Option A (recommended): compute from videos (source of truth)
  const agg = await prisma.video.aggregate({
    where: {
      orgId: owner.orgId,
      deletedAt: null,
      // Only count videos that actually represent stored originals:
      originalKey: { not: null },
      originalSize: { not: null },
    },
    _sum: { originalSize: true },
  });

  const used = Number(agg._sum.originalSize ?? 0);

  return NextResponse.json({
    ok: true,
    usedBytes: String(used),
    limitBytes: String(STORAGE_LIMIT_BYTES),
  });
}