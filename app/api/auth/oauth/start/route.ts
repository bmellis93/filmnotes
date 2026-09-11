// app/api/auth/oauth/start/route.ts -- the private/free GHL app.
//
// Deliberately not linked from anywhere public -- reached only via
// app/private/login (Ben's own gated personal entry point), not the public
// app/login (which is the real customer reconnect flow, for paid/agency
// orgs only). Gated on a shared secret so a random visitor (e.g. a GHL
// Marketplace reviewer poking around the site) can't stumble into a real
// OAuth handshake for the private app at all, rather than relying solely
// on the callback-side allowlist (lib/ghl/oauthCallback.ts's
// isAllowedNewPrivateOrg) to reject them afterward.
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getPrivateAppConfig } from "@/lib/ghl/oauthApps";
import { buildOauthStartResponse } from "@/lib/ghl/oauthStart";

export const runtime = "nodejs";

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const secret = process.env.PRIVATE_APP_LOGIN_SECRET;
  const key = req.nextUrl.searchParams.get("key");

  if (!secret || !key || !safeEqual(key, secret)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return buildOauthStartResponse(req, getPrivateAppConfig());
}
