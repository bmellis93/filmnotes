// app/api/comments/notify-flush/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireValidShareToken } from "@/lib/share-auth";
import { parseAllowedIds } from "@/lib/share/shareLinkUtils";
import { flushPendingCommentNotifications } from "@/lib/notify/flushCommentNotifications";

export const runtime = "nodejs";

/**
 * Called from useFlushCommentNotifications.ts -- on a 15-minute debounce
 * after the client's last comment, or when they leave the review page.
 * Always returns 200/ok: the caller is often a fetch(keepalive) mid-unload
 * that can't act on a real error, and a failure here should never surface
 * to the reviewer. Failures are logged inside flushPendingCommentNotifications
 * itself (via sendOwnerWebhook's existing best-effort behavior).
 */
export async function POST(req: NextRequest) {
  try {
    const { token, videoId } = await req.json().catch(() => ({}) as Record<string, unknown>);

    const res = await requireValidShareToken(String(token || ""));
    if (!res.ok) {
      return NextResponse.json({ ok: true, ignored: res.error });
    }

    const vid = String(videoId || "").trim();
    if (!vid || !parseAllowedIds(res.share).includes(vid)) {
      return NextResponse.json({ ok: true, ignored: "Video not allowed for this link" });
    }

    await flushPendingCommentNotifications(vid, new URL(req.url).origin);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("notify-flush error:", err);
    return NextResponse.json({ ok: true });
  }
}
