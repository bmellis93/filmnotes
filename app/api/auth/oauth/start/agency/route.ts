// app/api/auth/oauth/start/agency/route.ts -- the agency-tier GHL Marketplace app.
import { NextRequest } from "next/server";
import { getAgencyAppConfig } from "@/lib/ghl/oauthApps";
import { buildOauthStartResponse } from "@/lib/ghl/oauthStart";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return buildOauthStartResponse(req, getAgencyAppConfig());
}
