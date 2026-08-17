import { NextRequest, NextResponse } from "next/server";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { getGhlAccessToken, ghlHeaders } from "@/lib/ghl/client";

export const runtime = "nodejs";

const GHL_BASE_URL = process.env.GHL_API_BASE_URL!;

export type EmailBuilderItem =
  | { id: string; type: "folder"; name: string; childCount: number }
  | { id: string; type: "template"; name: string; previewUrl: string | null; lastUpdated: string | null };

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "VIEWER");
    const { orgId } = ctx;
    const accessToken = await getGhlAccessToken(orgId);

    const parentId = req.nextUrl.searchParams.get("parentId");

    const url = new URL(`${GHL_BASE_URL}/emails/builder`);
    url.searchParams.set("locationId", orgId);
    url.searchParams.set("limit", "100");
    url.searchParams.set("archived", "false");
    url.searchParams.set("builderVersion", "2");
    if (parentId) url.searchParams.set("parentId", parentId);

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
            ? "GHL doesn't have permission to read Email Builder templates yet. Reconnect the GHL integration to enable this."
            : "Failed to fetch Email Builder templates from GHL",
          detail: text,
        },
        { status: res.status }
      );
    }

    const data = await res.json().catch(() => ({}));
    const rows: any[] = Array.isArray(data?.builders) ? data.builders : [];

    const items: EmailBuilderItem[] = rows.map((row) => {
      if (row?.templateType === "folder") {
        return {
          id: String(row.id),
          type: "folder",
          name: String(row.name || "Untitled folder"),
          childCount: Number(row.childCount || 0),
        };
      }
      return {
        id: String(row.id),
        type: "template",
        name: String(row.name || "Untitled"),
        previewUrl: row.previewUrl ? String(row.previewUrl) : null,
        lastUpdated: row.lastUpdated ? String(row.lastUpdated) : null,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: err?.message === "Forbidden" ? 403 : 500 });
  }
}
