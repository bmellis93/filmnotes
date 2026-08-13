import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOwnerContext();
    const { id } = await params;

    const existing = await prisma.shareLink.findFirst({
      where: { id, orgId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}) as any);

    const data: { allowComments?: boolean; allowDownload?: boolean } = {};
    if (typeof body.allowComments === "boolean") data.allowComments = body.allowComments;
    if (typeof body.allowDownload === "boolean") data.allowDownload = body.allowDownload;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.shareLink.update({
      where: { id },
      data,
      select: { id: true, allowComments: true, allowDownload: true },
    });

    return NextResponse.json({ ok: true, share: updated });
  } catch (err: any) {
    console.error("Update share error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOwnerContext();
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
      { status: 500 }
    );
  }
}
