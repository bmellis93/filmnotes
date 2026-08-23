import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { hashSharePassword } from "@/lib/share/sharePassword";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "CONTRIBUTOR");
    const { orgId } = ctx;
    const { id } = await params;

    const existing = await prisma.shareLink.findFirst({
      where: { id, orgId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}) as any);

    const data: {
      allowComments?: boolean;
      allowDownload?: boolean;
      expiresAt?: Date | null;
      revokedAt?: Date | null;
      passwordHash?: string | null;
    } = {};
    if (typeof body.allowComments === "boolean") data.allowComments = body.allowComments;
    if (typeof body.allowDownload === "boolean") data.allowDownload = body.allowDownload;

    if (body.expiresInDays !== undefined) {
      const days = body.expiresInDays === null ? null : Number(body.expiresInDays);
      data.expiresAt = days && !Number.isNaN(days) ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
    }

    if (typeof body.revoked === "boolean") {
      data.revokedAt = body.revoked ? new Date() : null;
    }

    // password: absent -> leave unchanged, null -> clear, non-empty string -> set/change
    if (body.password !== undefined) {
      const trimmed = typeof body.password === "string" ? body.password.trim() : "";
      data.passwordHash = trimmed ? hashSharePassword(trimmed) : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.shareLink.update({
      where: { id },
      data,
      select: {
        id: true,
        allowComments: true,
        allowDownload: true,
        expiresAt: true,
        revokedAt: true,
        passwordHash: true,
      },
    });

    // Never send the hash itself to the client -- just whether one is set.
    const { passwordHash, ...rest } = updated;
    return NextResponse.json({ ok: true, share: { ...rest, hasPassword: passwordHash != null } });
  } catch (err: any) {
    console.error("Update share error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "CONTRIBUTOR");
    const { orgId } = ctx;
    const { id } = await params;

    const existing = await prisma.shareLink.findFirst({
      where: { id, orgId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.shareLink.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Delete share error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}
