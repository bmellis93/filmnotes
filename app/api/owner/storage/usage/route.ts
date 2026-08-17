import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function GET() {
  const owner = await requireOwnerContext();
  requireRole(owner, "VIEWER");

  // Option A (recommended): compute from videos (source of truth)
  const [agg, org] = await Promise.all([
    prisma.video.aggregate({
      where: {
        orgId: owner.orgId,
        deletedAt: null,
        // Only count videos that actually represent stored originals:
        originalKey: { not: null },
        originalSize: { not: null },
      },
      _sum: { originalSize: true },
    }),
    prisma.org.findUnique({
      where: { id: owner.orgId },
      select: { storageLimitBytes: true, plan: true },
    }),
  ]);

  const used = Number(agg._sum.originalSize ?? 0);
  const limitBytes = org?.storageLimitBytes ?? BigInt(0);

  return NextResponse.json({
    ok: true,
    usedBytes: String(used),
    limitBytes: String(limitBytes),
    plan: org?.plan ?? "STARTER",
  });
}