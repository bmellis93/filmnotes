// app/api/ghl/sso/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { decryptGhlSsoPayload, type GhlSsoContext } from "@/lib/ghl/ssoContext";
import { hasRole } from "@/lib/auth/roles";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

// GHL issues a distinct Custom Page shared secret per marketplace app
// registration, and the encrypted payload carries no hint of which app sent
// it -- so we can't pick the right secret up front. Try each configured
// edition's secret in turn; the wrong key reliably fails AES-CBC padding.
function decryptWithAnySecret(payload: string, secrets: string[]): GhlSsoContext {
  let lastErr: unknown;
  for (const secret of secrets) {
    try {
      return decryptGhlSsoPayload(payload, secret);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// Reuses the same signing secret as the owner-session cookie, but this token
// carries a distinct shape (`scope: "embed"`, no `role`) so it can't be
// replayed against requireOwnerContext()/assertOwnerContext.
const EMBED_TOKEN_TTL = "15m";

/**
 * Called from the embedded Custom Page (app/embed/page.tsx) with the
 * encrypted payload GHL posted to it via `window.parent.postMessage`.
 *
 * Custom Pages render in a cross-site iframe (your domain framed inside
 * app.gohighlevel.com), so the existing owner-session cookie (SameSite=Lax)
 * never reaches you there -- browsers won't send it on a framed subresource
 * request. Instead we hand back a short-lived bearer token the client holds
 * in memory/sessionStorage and attaches to API calls itself.
 */
export async function POST(req: NextRequest) {
  // Config errors (missing env vars) are ours, not the caller's -- keep them
  // out of the payload try/catch below so they don't get reported back as
  // "Invalid SSO payload".
  const sharedSecrets = [mustEnv("GHL_SSO_SHARED_SECRET"), process.env.GHL_PAID_SSO_SHARED_SECRET].filter(
    (s): s is string => Boolean(s)
  );
  const appJwtSecret = mustEnv("APP_JWT_SECRET");

  try {
    const body = await req.json().catch(() => null);
    const key = body?.key;
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const ctx = decryptWithAnySecret(key, sharedSecrets);

    // Only a location maps to an Org/Installation in our data model today.
    // An agency-level mount (no activeLocation) has nothing to look up yet.
    const orgId = ctx.activeLocation;
    if (!orgId) {
      return NextResponse.json({ connected: false, reason: "no-location" as const });
    }

    const installation = await prisma.installation.findUnique({
      where: { orgId },
      select: { orgId: true },
    });

    if (!installation) {
      const authorizeUrl = new URL("/api/auth/oauth/start", req.url);
      authorizeUrl.searchParams.set("next", "/embed/connected");
      return NextResponse.json({
        connected: false as const,
        reason: "not-installed" as const,
        connectUrl: authorizeUrl.toString(),
      });
    }

    const userId = ctx.userId ?? "unknown";
    const member = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: { role: true },
    });

    if (member && !hasRole(member.role, "VIEWER")) {
      return NextResponse.json({ connected: false as const, reason: "no-access" as const });
    }

    const secretKey = new TextEncoder().encode(appJwtSecret);
    const embedToken = await new SignJWT({
      orgId,
      userId,
      scope: "embed",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(EMBED_TOKEN_TTL)
      .sign(secretKey);

    return NextResponse.json({ connected: true as const, embedToken, orgId });
  } catch (err: any) {
    console.error("GHL SSO decrypt failed:", err);
    return NextResponse.json({ error: "Invalid SSO payload" }, { status: 400 });
  }
}
