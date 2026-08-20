// app/api/auth/oauth/callback/route.ts -- the private/free GHL app.
import { NextRequest } from "next/server";
import { getPrivateAppConfig } from "@/lib/ghl/oauthApps";
import { handleOauthCallback } from "@/lib/ghl/oauthCallback";
import { handleReviewerConnectCallback } from "@/lib/ghl/reviewerConnect";

export const runtime = "nodejs";

function isReviewerConnectState(stateRaw: string | null): boolean {
  if (!stateRaw) return false;
  try {
    return JSON.parse(decodeURIComponent(stateRaw))?.purpose === "reviewer-connect";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  // Same registered redirect URI serves two purposes: a normal customer
  // install (below), or attaching a reviewer's own sandbox to the fixed
  // demo org (see app/api/auth/reviewer-connect/start/route.ts) -- the
  // latter is state-tagged, so real installs are completely unaffected.
  const state = new URL(req.url).searchParams.get("state");
  if (isReviewerConnectState(state)) {
    return handleReviewerConnectCallback(req);
  }

  return handleOauthCallback(req, getPrivateAppConfig());
}
