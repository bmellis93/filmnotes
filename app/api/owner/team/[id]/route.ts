import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import type { OrgRole } from "@prisma/client";

export const runtime = "nodejs";

const VALID_ROLES: OrgRole[] = ["NONE", "VIEWER", "UPLOADER", "CONTRIBUTOR", "ADMIN"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "ADMIN");
    const { id } = await params;

    const existing = await prisma.orgMember.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, role: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}) as any);
    const role = body?.role;
    if (typeof role !== "string" || !VALID_ROLES.includes(role as OrgRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Don't let the org's last admin demote themselves (or be demoted) --
    // that would lock everyone out of Settings with no way back in.
    if (existing.role === "ADMIN" && role !== "ADMIN") {
      const otherAdmins = await prisma.orgMember.count({
        where: { orgId: ctx.orgId, role: "ADMIN", id: { not: id } },
      });
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: "Can't remove the last admin -- promote someone else first" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.orgMember.update({
      where: { id },
      data: { role: role as OrgRole },
      select: { id: true, role: true },
    });

    return NextResponse.json({ ok: true, member: updated });
  } catch (err: any) {
    console.error("Update team member role error:", err?.message || err);
    const status = err?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json(
      { error: status === 403 ? "Forbidden" : "Server error", detail: err?.message || String(err) },
      { status }
    );
  }
}
