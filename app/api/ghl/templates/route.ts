import { NextResponse } from "next/server";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { getGhlAccessToken, ghlHeaders } from "@/lib/ghl/client";

export const runtime = "nodejs";

const GHL_BASE_URL = process.env.GHL_API_BASE_URL!;

export type GhlTemplate =
  | { id: string; type: "sms"; name: string; body: string }
  | { id: string; type: "email"; name: string; subject: string; html: string };

export async function GET() {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "VIEWER");
    const { orgId } = ctx;
    const accessToken = await getGhlAccessToken(orgId);

    // Note: GHL's `originId` param filters by the id of whichever user created
    // the template (not the location id) -- there's no single value we could
    // pass that would include everyone's templates, so we omit it and get
    // every template for the location instead.
    const url = new URL(`${GHL_BASE_URL}/locations/${orgId}/templates`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("deleted", "false");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: ghlHeaders(accessToken),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const missingScope = res.status === 401 || res.status === 403;
      return NextResponse.json(
        {
          error: missingScope
            ? "GHL doesn't have permission to read templates yet. Reconnect the GHL integration to enable this."
            : "Failed to fetch templates from GHL",
          detail: text,
        },
        { status: res.status }
      );
    }

    const data = await res.json().catch(() => ({}));
    const rows: any[] = Array.isArray(data?.templates) ? data.templates : [];

    const sms: GhlTemplate[] = [];
    const email: GhlTemplate[] = [];

    for (const row of rows) {
      if (row?.type === "sms" && row?.template) {
        sms.push({
          id: String(row.id),
          type: "sms",
          name: String(row.name || "Untitled"),
          body: String(row.template.body || ""),
        });
      } else if (row?.type === "email" && row?.template) {
        email.push({
          id: String(row.id),
          type: "email",
          name: String(row.name || "Untitled"),
          subject: String(row.template.subject || ""),
          html: String(row.template.html || ""),
        });
      }
    }

    return NextResponse.json({ ok: true, sms, email });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: err?.message === "Forbidden" ? 403 : 500 });
  }
}
