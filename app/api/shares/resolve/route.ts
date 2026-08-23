// app/api/shares/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { loadGatedShare } from "@/lib/share/shareGate";
import { unlockCookieName } from "@/lib/share/sharePassword";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const t = String(token || "").trim();

    if (!t) return NextResponse.json({ error: "token required" }, { status: 400 });

    const unlockProof = req.cookies.get(unlockCookieName(t))?.value ?? null;
    const gate = await loadGatedShare(t, unlockProof);
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.error, passwordRequired: gate.passwordRequired },
        { status: gate.status }
      );
    }
    const share = gate.share;

    return NextResponse.json({
      ok: true,
      token: share.token,
      videoId: share.videoId,
      galleryId: share.galleryId,
      title: share.title,
      view: share.view,
      allowComments: share.allowComments,
      allowDownload: share.allowDownload,
      allowedVideoIdsJson: share.allowedVideoIdsJson,
      stacksJson: share.stacksJson,
      expiresAt: share.expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}