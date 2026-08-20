// app/api/auth/reviewer-login/route.ts
//
// A password-gated login into one fixed, dedicated review/demo org --
// separate from the NODE_ENV-gated /api/dev/owner/login backdoor (which
// accepts ANY org id and is disabled in production). This route only ever
// resolves to REVIEWER_ORG_ID -- never client-supplied -- so there's no
// impersonation risk even though it's reachable in production. Meant for
// handing a login URL + password to the GHL Marketplace review team so
// they can test the app without going through OAuth.
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { setOwnerSession } from "@/lib/auth/ownerSession";
import type { OrgRole } from "@prisma/client";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  try {
    const secret = mustEnv("REVIEWER_LOGIN_SECRET");
    const orgId = mustEnv("REVIEWER_ORG_ID");
    const userId = process.env.REVIEWER_USER_ID || "reviewer-user";
    const role = (process.env.REVIEWER_ROLE as OrgRole) || "ADMIN";

    const { password } = await req.json().catch(() => ({}) as Record<string, unknown>);

    if (typeof password !== "string" || !safeEqual(password, secret)) {
      return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
    }

    await setOwnerSession({ orgId, userId, role });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Reviewer login error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
