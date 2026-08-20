// app/api/auth/oauth/start/paid/route.ts -- the public/paid GHL Marketplace app.
import { NextRequest } from "next/server";
import { getPaidAppConfig } from "@/lib/ghl/oauthApps";
import { buildOauthStartResponse } from "@/lib/ghl/oauthStart";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return buildOauthStartResponse(req, getPaidAppConfig());
}
