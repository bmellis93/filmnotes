// app/api/auth/oauth/start/route.ts -- the private/free GHL app.
import { NextRequest } from "next/server";
import { getPrivateAppConfig } from "@/lib/ghl/oauthApps";
import { buildOauthStartResponse } from "@/lib/ghl/oauthStart";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return buildOauthStartResponse(req, getPrivateAppConfig());
}
