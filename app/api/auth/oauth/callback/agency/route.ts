// app/api/auth/oauth/callback/agency/route.ts -- the agency-tier GHL Marketplace app.
import { NextRequest } from "next/server";
import { getAgencyAppConfig } from "@/lib/ghl/oauthApps";
import { handleOauthCallback } from "@/lib/ghl/oauthCallback";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return handleOauthCallback(req, getAgencyAppConfig());
}
