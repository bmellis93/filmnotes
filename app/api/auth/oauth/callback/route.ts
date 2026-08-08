import { NextRequest, NextResponse } from "next/server";
import { setOwnerSession } from "@/lib/auth/ownerSession";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function exchangeCodeForToken(code: string) {
  const base = mustEnv("GHL_API_BASE_URL"); // ✅ leadconnector
  const clientId = mustEnv("GHL_CLIENT_ID");
  const clientSecret = mustEnv("GHL_CLIENT_SECRET");
  const redirectUri = mustEnv("GHL_REDIRECT_URI");

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  const res = await fetch(`${base}/oauth/token`, {
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
  };
}

async function resolveOrgAndUser(accessToken: string) {
  const base = mustEnv("GHL_API_BASE_URL");

  // Try users/me (if scope allows)
  let userId: string | null = null;
  try {
    const meRes = await fetch(`${base}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (meRes.ok) {
      const me = await meRes.json().catch(() => null);
      userId = (me?.id && String(me.id)) || (me?.user?.id && String(me.user.id)) || null;
    }
  } catch {}

  // Get first location (or later you can let them choose)
  const locRes = await fetch(`${base}/locations`, {
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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");

    if (!code) throw new Error("Missing code");

    // Validate state + nonce cookie
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

    const token = await exchangeCodeForToken(code);

    // If token includes these, use them; otherwise call API
    let orgId = token.locationId ? String(token.locationId) : null;
    let userId = token.userId ? String(token.userId) : null;

    if (!orgId) {
      // Only hit the API when the token exchange didn't give us a location.
      const resolved = await resolveOrgAndUser(token.access_token);
      orgId = resolved.orgId;
      userId = userId ?? resolved.userId;
    } else if (!userId) {
      userId = "unknown";
    }

    const ctx = { orgId, userId };

    // Org row must exist before Installation can reference it.
    await prisma.org.upsert({
      where: { id: ctx.orgId },
      create: { id: ctx.orgId },
      update: {},
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

    // Everyone is "ADMIN" in your app model
    await setOwnerSession({ orgId: ctx.orgId, userId: ctx.userId, role: "ADMIN" });

    const res = NextResponse.redirect(new URL(next, url.origin));
    res.cookies.set("rm_oauth_nonce", "", { path: "/", maxAge: 0 });
    return res;
  } catch (err: any) {
    console.error("OAUTH CALLBACK ERROR:", err);
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/owner/galleries")}`, req.url));
  }
}