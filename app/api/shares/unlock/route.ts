// app/api/shares/unlock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeUnlockProof,
  unlockCookieMaxAgeSeconds,
  unlockCookieName,
  verifySharePasswordHash,
} from "@/lib/share/sharePassword";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}) as any);
    const token = String(body?.token || "").trim();
    const password = String(body?.password || "");

    if (!token || !password) {
      return NextResponse.json({ ok: false, error: "Missing token or password" }, { status: 400 });
    }

    const share = await prisma.shareLink.findUnique({
      where: { token },
      select: { token: true, passwordHash: true, expiresAt: true, revokedAt: true },
    });

    if (!share || share.revokedAt) {
      return NextResponse.json({ ok: false, error: "Invalid link" }, { status: 404 });
    }
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "Link expired" }, { status: 410 });
    }
    if (!share.passwordHash) {
      // Nothing to unlock -- treat as success so a stale gate doesn't get stuck.
      return NextResponse.json({ ok: true });
    }

    if (!verifySharePasswordHash(password, share.passwordHash)) {
      return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
    }

    const proof = computeUnlockProof(share.token, share.passwordHash);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(unlockCookieName(share.token), proof, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: unlockCookieMaxAgeSeconds(share.expiresAt),
    });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
