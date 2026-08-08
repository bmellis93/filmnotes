import { NextRequest, NextResponse } from "next/server";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getGhlAccessToken, ghlHeaders } from "@/lib/ghl/client";

const GHL_BASE_URL = process.env.GHL_API_BASE_URL!;

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await requireOwnerContext();
    const accessToken = await getGhlAccessToken(orgId);

    const { query } = await req.json();
    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
    }

    const res = await fetch(`${GHL_BASE_URL}/contacts/search`, {
      method: "POST",
      headers: ghlHeaders(accessToken),
      body: JSON.stringify({
        locationId: orgId,       // ✅ orgId = locationId
        query,
        pageLimit: 20,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    const contacts = (data.contacts || []).map((c: any) => {
      const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
      return {
        id: c.id,
        name: name || "Unnamed Contact",
        email: c.email || null,
        phone: c.phone || null,
        canEmail: Boolean(c.email),
        canSms: Boolean(c.phone),
      };
    });

    return NextResponse.json({ contacts });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}