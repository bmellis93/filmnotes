import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { orgId } = await requireOwnerContext();

    const members = await prisma.orgMember.findMany({
      where: { orgId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });

    const team = members.map((m) => ({
      id: m.id,
      ghlUserId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    }));

    return NextResponse.json({ ok: true, team });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
