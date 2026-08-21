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
      select: { notificationWebhookUrl: true, notificationEmail: true },
    });

    return NextResponse.json({
      ok: true,
      notificationWebhookUrl: org?.notificationWebhookUrl ?? null,
      notificationEmail: org?.notificationEmail ?? null,
    });
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

    // Each field has its own Save button in Settings -- only touch whichever
    // one is actually present in this request, never clobber the other.
    const data: { notificationWebhookUrl?: string | null; notificationEmail?: string | null } = {};

    if ("notificationWebhookUrl" in body) {
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

      data.notificationWebhookUrl = raw || null;
    }

    if ("notificationEmail" in body) {
      const raw = String(body.notificationEmail || "").trim();

      if (raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        return NextResponse.json({ error: "That doesn't look like a valid email" }, { status: 400 });
      }

      data.notificationEmail = raw || null;
    }

    const updated = await prisma.org.update({
      where: { id: orgId },
      data,
      select: { notificationWebhookUrl: true, notificationEmail: true },
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: err?.message === "Forbidden" ? 403 : 500 });
  }
}
