import "server-only";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import type { GhlAppConfig } from "@/lib/ghl/oauthApps";

/** Builds the GHL "choose location" redirect + CSRF nonce cookie for a given app config. */
export function buildOauthStartResponse(req: NextRequest, config: GhlAppConfig) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/owner/galleries";

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = JSON.stringify({ next: safeNext, nonce });

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
