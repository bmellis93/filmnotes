// app/api/auth/oauth/callback/route.ts -- the private/free GHL app.
import { NextRequest } from "next/server";
import { getPrivateAppConfig } from "@/lib/ghl/oauthApps";
import { handleOauthCallback } from "@/lib/ghl/oauthCallback";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return handleOauthCallback(req, getPrivateAppConfig());
}
