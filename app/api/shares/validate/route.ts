// app/api/shares/validate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireValidShareToken } from "@/lib/share-auth";
import { unlockCookieName } from "@/lib/share/sharePassword";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const t = String(token || "");

    const unlockProof = req.cookies.get(unlockCookieName(t))?.value ?? null;
    const res = await requireValidShareToken(t, unlockProof);
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error, passwordRequired: res.passwordRequired },
        { status: res.status }
      );
    }

    const { share } = res;

    return NextResponse.json({
      ok: true,
      token: share.token,
      videoId: share.videoId,
      galleryId: share.galleryId,
      title: share.title,
      view: share.view,
      allowComments: share.allowComments,
      allowDownload: share.allowDownload,
      expiresAt: share.expiresAt,
      allowedVideoIdsJson: share.allowedVideoIdsJson,
      stacksJson: share.stacksJson,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}