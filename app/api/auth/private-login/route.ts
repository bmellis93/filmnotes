// app/api/auth/private-login/route.ts
//
// Re-issues Ben's own owner-session cookie directly for the one org the
// private app is installed on, without a GHL OAuth round trip. GHL's own
// authorize screen only offers "Uninstall" once a browser/org is already
// authenticated+installed (confirmed live against production) -- there's
// no "continue"/"reauthorize" option, so /api/auth/oauth/start can't
// actually be completed for a routine re-login. That's fine: this session
// cookie is purely our own app's auth, independent of the GHL access/
// refresh token pair in Installation, which lib/ghl/client.ts already
// refreshes on demand regardless of whether this cookie is current.
//
// Gated the same way as /api/auth/oauth/start (PRIVATE_APP_LOGIN_SECRET) --
// not linked from anywhere public except the bookmarked /private/login page.
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { setOwnerSession } from "@/lib/auth/ownerSession";

export const runtime = "nodejs";

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const secret = process.env.PRIVATE_APP_LOGIN_SECRET;
  const key = req.nextUrl.searchParams.get("key");

  if (!secret || !key || !safeEqual(key, secret)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const orgId = process.env.PRIVATE_APP_OWNER_ORG_ID;
  if (!orgId) {
    return NextResponse.json({ error: "PRIVATE_APP_OWNER_ORG_ID not configured" }, { status: 500 });
  }

  const member = await prisma.orgMember.findFirst({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: { userId: true, role: true },
  });

  if (!member) {
    return NextResponse.json({ error: `No OrgMember found for org ${orgId}` }, { status: 404 });
  }

  await setOwnerSession({ orgId, userId: member.userId, role: member.role });

  const nextParam = req.nextUrl.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/owner/galleries";

  return NextResponse.redirect(new URL(next, req.url));
}
