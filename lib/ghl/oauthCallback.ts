import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { setOwnerSession } from "@/lib/auth/ownerSession";
import { prisma } from "@/lib/prisma";
import type { GhlAppConfig } from "@/lib/ghl/oauthApps";

export async function exchangeCodeForToken(code: string, config: GhlAppConfig) {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  body.set("code", code);
  body.set("redirect_uri", config.redirectUri);

  const res = await fetch(`${config.apiBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(json)}`);

  return json as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    locationId?: string;
    userId?: string;
    companyId?: string;
  };
}

async function resolveOrgAndUser(accessToken: string, config: GhlAppConfig) {
  let userId: string | null = null;
  try {
    const meRes = await fetch(`${config.apiBaseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (meRes.ok) {
      const me = await meRes.json().catch(() => null);
      userId = (me?.id && String(me.id)) || (me?.user?.id && String(me.user.id)) || null;
    }
  } catch {}

  const locRes = await fetch(`${config.apiBaseUrl}/locations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!locRes.ok) {
    const txt = await locRes.text().catch(() => "");
    throw new Error(`Failed to fetch locations (${locRes.status}): ${txt}`);
  }

  const loc = await locRes.json().catch(() => null);
  const first = (Array.isArray(loc) ? loc[0] : loc?.locations?.[0]) ?? null;
  const orgId = first?.id ? String(first.id) : null;

  if (!orgId) throw new Error("Could not resolve location (orgId)");
  if (!userId) userId = "unknown";

  return { orgId, userId };
}

/** Shared GHL OAuth callback handler, parameterized by which app (private/paid) issued the code. */
export async function handleOauthCallback(req: NextRequest, config: GhlAppConfig) {
  const url = new URL(req.url);
  try {
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");

    if (!code) throw new Error("Missing code");

    let next = "/owner/galleries";
    let nonceFromState: string | null = null;

    if (stateRaw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(stateRaw));
        if (parsed?.next && typeof parsed.next === "string" && parsed.next.startsWith("/")) {
          next = parsed.next;
        }
        if (parsed?.nonce && typeof parsed.nonce === "string") nonceFromState = parsed.nonce;
      } catch {}
    }

    const nonceCookie = req.cookies.get("rm_oauth_nonce")?.value ?? null;
    if (!nonceCookie || !nonceFromState || nonceCookie !== nonceFromState) {
      throw new Error("Invalid OAuth state");
    }

    const token = await exchangeCodeForToken(code, config);

    let orgId = token.locationId ? String(token.locationId) : null;
    let userId = token.userId ? String(token.userId) : null;

    if (!orgId) {
      const resolved = await resolveOrgAndUser(token.access_token, config);
      orgId = resolved.orgId;
      userId = userId ?? resolved.userId;
    } else if (!userId) {
      userId = "unknown";
    }

    const ctx = { orgId, userId };
    const companyId = token.companyId ? String(token.companyId) : null;

    // appEdition is set only on create -- once an org is tagged PRIVATE or
    // PAID it shouldn't flip on a later re-login, since billing/plan logic
    // downstream depends on it staying stable for that org's lifetime.
    await prisma.org.upsert({
      where: { id: ctx.orgId },
      create: { id: ctx.orgId, appEdition: config.edition, ...(companyId ? { companyId } : {}) },
      update: { ...(companyId ? { companyId } : {}) },
    });

    const expiresAt =
      typeof token.expires_in === "number" && token.expires_in > 0
        ? new Date(Date.now() + token.expires_in * 1000)
        : null;

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

    await prisma.appUser.upsert({
      where: { id: ctx.userId },
      create: { id: ctx.userId },
      update: {},
    });

    const existingMember = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: ctx.orgId, userId: ctx.userId } },
    });

    let role: "VIEWER" | "UPLOADER" | "CONTRIBUTOR" | "ADMIN";
    if (existingMember) {
      role = existingMember.role;
    } else {
      const memberCount = await prisma.orgMember.count({ where: { orgId: ctx.orgId } });
      role = memberCount === 0 ? "ADMIN" : "VIEWER";
      await prisma.orgMember.create({
        data: { orgId: ctx.orgId, userId: ctx.userId, role },
      });
    }

    await setOwnerSession({ orgId: ctx.orgId, userId: ctx.userId, role });

    const res = NextResponse.redirect(new URL(next, url.origin));
    res.cookies.set("rm_oauth_nonce", "", { path: "/", maxAge: 0 });
    return res;
  } catch (err: any) {
    console.error(`OAUTH CALLBACK ERROR (${config.edition}):`, err);
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/owner/galleries")}`, url.origin));
  }
}
