import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

const SELECT = {
  defaultSmsTemplateId: true,
  defaultEmailTemplateId: true,
  defaultEmailTemplateSource: true,
  defaultEmailTemplateName: true,
  defaultEmailTemplatePreviewUrl: true,
} as const;

export async function GET() {
  try {
    const { orgId } = await requireOwnerContext();

    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: SELECT,
    });

    return NextResponse.json({
      ok: true,
      defaultSmsTemplateId: org?.defaultSmsTemplateId ?? null,
      defaultEmailTemplateId: org?.defaultEmailTemplateId ?? null,
      defaultEmailTemplateSource: org?.defaultEmailTemplateSource ?? null,
      defaultEmailTemplateName: org?.defaultEmailTemplateName ?? null,
      defaultEmailTemplatePreviewUrl: org?.defaultEmailTemplatePreviewUrl ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await requireOwnerContext();
    const body = await req.json().catch(() => ({}));

    const defaultSmsTemplateId =
      body.defaultSmsTemplateId === null ? null : String(body.defaultSmsTemplateId || "").trim() || null;
    const defaultEmailTemplateId =
      body.defaultEmailTemplateId === null ? null : String(body.defaultEmailTemplateId || "").trim() || null;
    const defaultEmailTemplateSource =
      body.defaultEmailTemplateSource === null ? null : String(body.defaultEmailTemplateSource || "").trim() || null;
    const defaultEmailTemplateName =
      body.defaultEmailTemplateName === null ? null : String(body.defaultEmailTemplateName || "").trim() || null;
    const defaultEmailTemplatePreviewUrl =
      body.defaultEmailTemplatePreviewUrl === null
        ? null
        : String(body.defaultEmailTemplatePreviewUrl || "").trim() || null;

    const updated = await prisma.org.update({
      where: { id: orgId },
      data: {
        defaultSmsTemplateId,
        defaultEmailTemplateId,
        defaultEmailTemplateSource,
        defaultEmailTemplateName,
        defaultEmailTemplatePreviewUrl,
      },
      select: SELECT,
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
