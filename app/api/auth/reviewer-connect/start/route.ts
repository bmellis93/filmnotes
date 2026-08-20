// app/api/auth/reviewer-connect/start/route.ts
//
// Lets the GHL Marketplace reviewer attach their own GHL sandbox to the
// fixed demo org they're already logged into via /reviewer-login, using a
// real OAuth handshake -- no credentials ever get typed into our app.
// Only reachable by someone already authenticated as REVIEWER_ORG_ID.
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getPrivateAppConfig } from "@/lib/ghl/oauthApps";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ctx = await requireOwnerContext();
  if (ctx.orgId !== process.env.REVIEWER_ORG_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = getPrivateAppConfig();

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = JSON.stringify({ purpose: "reviewer-connect", nonce });

  const auth = new URL(config.authorizeUrl);
  auth.searchParams.set("client_id", config.clientId);
  auth.searchParams.set("redirect_uri", config.redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", config.scopes);
  auth.searchParams.set("state", state);

  const res = NextResponse.redirect(auth.toString());
  res.cookies.set("rm_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return res;
}
