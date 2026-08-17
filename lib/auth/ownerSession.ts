// lib/auth/ownerSession.ts
import "server-only";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasRole as hasRoleShared } from "@/lib/auth/roles";

const COOKIE_NAME = "rm_owner_session";
const ORG_ROLES: OrgRole[] = ["VIEWER", "UPLOADER", "CONTRIBUTOR", "ADMIN"];

const JWT_SECRET = process.env.APP_JWT_SECRET;
if (!JWT_SECRET) throw new Error("Missing APP_JWT_SECRET");

const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export type OwnerContext = {
  orgId: string;
  userId: string;
  role: OrgRole;
};

function assertOwnerContext(payload: any): asserts payload is OwnerContext {
  if (!payload || typeof payload !== "object") throw new Error("Invalid session");

  const { orgId, userId, role } = payload as Partial<OwnerContext>;

  if (!orgId || !userId || !role || !ORG_ROLES.includes(role)) {
    throw new Error("Invalid session");
  }
}

/**
 * NOTE:
 * - cookies().set only works in Route Handlers / Server Actions.
 * - In Next 15, cookies() is async, so we must await it.
 */
export async function setOwnerSession(ctx: OwnerContext) {
  const token = await new SignJWT(ctx as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);

  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearOwnerSession() {
  const c = await cookies();
  c.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Custom Pages (the GHL-embedded dashboard) render in a cross-site iframe,
 * where the owner-session cookie (SameSite=Lax) never arrives -- browsers
 * don't send it on framed subresource requests. The embed client instead
 * sends its short-lived SSO-derived token (see app/api/ghl/sso/route.ts) as
 * a Bearer header, which we check here before falling back to the cookie.
 * This only changes behavior when that header is present, so every existing
 * call site (Server Component pages included, which never receive a custom
 * Authorization header on a normal navigation) is unaffected.
 */
async function embedContextFromHeader(): Promise<OwnerContext | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  try {
    const { payload } = await jwtVerify(auth.slice("Bearer ".length), SECRET_KEY);
    if (payload.scope !== "embed" || typeof payload.orgId !== "string") return null;

    const orgId = payload.orgId;
    const userId = typeof payload.userId === "string" ? payload.userId : "unknown";

    // The embed token itself carries no role -- look up the real one. An
    // org only gets here after a normal OAuth install, which always
    // creates at least one OrgMember, so a missing row is unexpected; fall
    // back to VIEWER (never ADMIN) rather than guessing upward.
    const member = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: { role: true },
    });

    return { orgId, userId, role: member?.role ?? "VIEWER" };
  } catch {
    return null; // expired/invalid -- fall back to cookie auth
  }
}

export async function requireOwnerContext(): Promise<OwnerContext> {
  const embedCtx = await embedContextFromHeader();
  if (embedCtx) return embedCtx;

  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) {
    redirect(`/login?next=${encodeURIComponent("/owner/galleries")}`);
  }
  const { payload } = await jwtVerify(token, SECRET_KEY);

  // jose payload is JWTPayload; we stored plain object fields.
  const decoded = payload as unknown as OwnerContext;
  assertOwnerContext(decoded);

  return decoded;
}

export function hasRole(ctx: OwnerContext, min: OrgRole): boolean {
  return hasRoleShared(ctx.role, min);
}

export function requireRole(ctx: OwnerContext, min: OrgRole) {
  if (!hasRole(ctx, min)) throw new Error("Forbidden");
}
