import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "ADMIN");
    const { orgId } = ctx;

    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { notificationWebhookUrl: true },
    });

    return NextResponse.json({ ok: true, notificationWebhookUrl: org?.notificationWebhookUrl ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: err?.message === "Forbidden" ? 403 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "ADMIN");
    const { orgId } = ctx;
    const body = await req.json().catch(() => ({}));

    const raw = String(body.notificationWebhookUrl || "").trim();

    if (raw) {
      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        return NextResponse.json({ error: "That doesn't look like a valid URL" }, { status: 400 });
      }
      if (parsed.protocol !== "https:") {
        return NextResponse.json({ error: "Webhook URL must be https://" }, { status: 400 });
      }
    }

    const updated = await prisma.org.update({
      where: { id: orgId },
      data: { notificationWebhookUrl: raw || null },
      select: { notificationWebhookUrl: true },
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: err?.message === "Forbidden" ? 403 : 500 });
  }
}
