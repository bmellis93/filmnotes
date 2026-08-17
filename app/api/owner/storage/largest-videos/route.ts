import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export async function GET() {
  const owner = await requireOwnerContext();
  requireRole(owner, "VIEWER");

  const videos = await prisma.video.findMany({
    where: {
      orgId: owner.orgId,
      deletedAt: null,
      originalSize: { not: null },
    },
    orderBy: { originalSize: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      originalSize: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    videos: videos.map((v) => ({
      ...v,
      originalSize: v.originalSize?.toString() ?? "0",
    })),
  });
}