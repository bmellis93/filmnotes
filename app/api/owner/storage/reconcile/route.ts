// app/api/owner/storage/reconcile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function POST() {
  const owner = await requireOwnerContext();
  requireRole(owner, "ADMIN");
  const orgId = owner.orgId;

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { storageUsedBytes: true },
  });

const before = org?.storageUsedBytes ?? BigInt(0);

  const agg = await prisma.video.aggregate({
    where: {
      orgId,
      deletedAt: null,
      originalSize: { not: null },
    },
    _sum: { originalSize: true },
  });

  const used = BigInt(agg._sum.originalSize ?? 0);

  await prisma.org.update({
    where: { id: orgId },
    data: { storageUsedBytes: used },
  });

  return NextResponse.json({
    ok: true,
    beforeBytes: before.toString(),
    usedBytes: used.toString(),
    deltaBytes: (used - before).toString(),
  });
}