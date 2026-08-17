import { NextResponse } from "next/server";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

// Lets client components (notably the embed dashboard, whose bearer token
// carries no role) find out the current user's role without a full
// /api/owner/team round trip. Works over either auth path since it's just
// requireOwnerContext() -- no additional tier required, since knowing your
// own role isn't itself a privileged action.
export async function GET() {
  try {
    const ctx = await requireOwnerContext();
    return NextResponse.json({ ok: true, role: ctx.role });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
