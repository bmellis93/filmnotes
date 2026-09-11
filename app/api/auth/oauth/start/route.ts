// app/api/auth/oauth/start/route.ts -- the private/free GHL app.
//
// Deliberately not linked from anywhere public -- reached only via
// app/private/install (Ben's own gated reinstall/reauthorize entry point;
// a routine sign-in uses app/private/login instead, which skips this GHL
// round trip via api/auth/private-login). Not the public app/login either,
// which is the real customer reconnect flow, for paid/agency orgs only.
// Gated via lib/auth/privateAppGate.ts (key param or the long-lived gate
// cookie) so a random visitor (e.g. a GHL Marketplace reviewer poking
// around the site) can't stumble into a real OAuth handshake for the
// private app at all, rather than relying solely on the callback-side
// allowlist (lib/ghl/oauthCallback.ts's isAllowedNewPrivateOrg) to reject
// them afterward.
import { NextRequest, NextResponse } from "next/server";
import { getPrivateAppConfig } from "@/lib/ghl/oauthApps";
import { buildOauthStartResponse } from "@/lib/ghl/oauthStart";
import {
  isValidPrivateKey,
  PRIVATE_GATE_COOKIE_NAME,
  privateGateCookieOptions,
} from "@/lib/auth/privateAppGate";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.PRIVATE_APP_LOGIN_SECRET;
  const key = req.nextUrl.searchParams.get("key");
  const cookieKey = req.cookies.get(PRIVATE_GATE_COOKIE_NAME)?.value;

  if (!isValidPrivateKey(key) && !isValidPrivateKey(cookieKey)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const res = buildOauthStartResponse(req, getPrivateAppConfig());
  if (secret) res.cookies.set(PRIVATE_GATE_COOKIE_NAME, secret, privateGateCookieOptions());
  return res;
}
