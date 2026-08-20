import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getPrivateAppConfig } from "@/lib/ghl/oauthApps";
import { exchangeCodeForToken } from "@/lib/ghl/oauthCallback";

/**
 * Attaches a real GHL sandbox to the fixed reviewer demo org, instead of
 * creating a new Org the way the normal OAuth callback does -- the
 * reviewer is already logged in via /reviewer-login; this only gives that
 * existing org a working GHL Installation. Branched to from
 * app/api/auth/oauth/callback/route.ts when state.purpose === "reviewer-connect".
 */
export async function handleReviewerConnectCallback(req: NextRequest) {
  const url = new URL(req.url);

  try {
    const ctx = await requireOwnerContext();
    if (ctx.orgId !== process.env.REVIEWER_ORG_ID) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    if (!code) throw new Error("Missing code");

    let nonceFromState: string | null = null;
    if (stateRaw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(stateRaw));
        if (parsed?.nonce && typeof parsed.nonce === "string") nonceFromState = parsed.nonce;
      } catch {}
    }

    const nonceCookie = req.cookies.get("rm_oauth_nonce")?.value ?? null;
    if (!nonceCookie || !nonceFromState || nonceCookie !== nonceFromState) {
      throw new Error("Invalid OAuth state");
    }

    const token = await exchangeCodeForToken(code, getPrivateAppConfig());

    const expiresAt =
      typeof token.expires_in === "number" && token.expires_in > 0
        ? new Date(Date.now() + token.expires_in * 1000)
        : null;

    // Deliberately ignores token.locationId/companyId -- we're not creating
    // a new Org for whatever real location the reviewer picked, just
    // attaching its access token to the fixed demo org.
    await prisma.installation.upsert({
      where: { orgId: ctx.orgId },
      create: {
        orgId: ctx.orgId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? null,
        expiresAt,
      },
      update: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? null,
        ...(expiresAt ? { expiresAt } : {}),
      },
    });

    const res = NextResponse.redirect(new URL("/owner/settings?ghlConnected=1", url.origin));
    res.cookies.set("rm_oauth_nonce", "", { path: "/", maxAge: 0 });
    return res;
  } catch (err: any) {
    console.error("REVIEWER CONNECT CALLBACK ERROR:", err);
    return NextResponse.redirect(new URL("/owner/settings?ghlConnected=0", url.origin));
  }
}
