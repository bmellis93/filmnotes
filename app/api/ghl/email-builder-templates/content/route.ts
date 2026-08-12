import { NextRequest, NextResponse } from "next/server";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

// Email Builder template content is served from a public (token-in-URL)
// Firebase Storage link -- we proxy it server-side (rather than fetching
// client-side) to sidestep CORS and to make sure we only ever fetch from
// the one host GHL actually serves these from.
const ALLOWED_HOST = "firebasestorage.googleapis.com";

export async function GET(req: NextRequest) {
  try {
    await requireOwnerContext();

    const raw = req.nextUrl.searchParams.get("url");
    if (!raw) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    if (parsed.protocol !== "https:" || parsed.hostname !== ALLOWED_HOST) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
    }

    const res = await fetch(parsed.toString(), { method: "GET" });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch template content" }, { status: res.status });
    }

    const html = await res.text();
    return NextResponse.json({ ok: true, html });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
