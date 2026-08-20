// app/api/auth/oauth/callback/paid/route.ts -- the public/paid GHL Marketplace app.
import { NextRequest } from "next/server";
import { getPaidAppConfig } from "@/lib/ghl/oauthApps";
import { handleOauthCallback } from "@/lib/ghl/oauthCallback";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return handleOauthCallback(req, getPaidAppConfig());
}
