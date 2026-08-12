import { NextRequest, NextResponse } from "next/server";
import { requireValidShareToken } from "@/lib/share-auth";
import { prisma } from "@/lib/prisma";
import { parseAllowedIds } from "@/lib/share/shareLinkUtils";
import { sendOwnerWebhook, getOwnerVideoContext, buildOwnerVideoUrl } from "@/lib/notify/sendOwnerWebhook";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set(["APPROVED", "CHANGES_REQUESTED"]);

export async function POST(req: NextRequest) {
  try {
    const { token, videoId, status, note } = await req.json();

    const res = await requireValidShareToken(String(token || ""));
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    const share = res.share;

    const orgId = String(share.orgId || "").trim();
    if (!orgId) {
      return NextResponse.json({ error: "Invalid share link (missing orgId)" }, { status: 400 });
    }

    const vid = String(videoId || "").trim();
    if (!vid) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const allowed = parseAllowedIds(share);
    if (!allowed.includes(vid)) {
      return NextResponse.json({ error: "Video not allowed for this link" }, { status: 403 });
    }

    if (share.view === "VIEW_ONLY" || !share.allowComments) {
      return NextResponse.json({ error: "Approval actions disabled for this link" }, { status: 403 });
    }

    const nextStatus = String(status || "").trim().toUpperCase();
    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const trimmedNote = String(note || "").trim();
    if (nextStatus === "CHANGES_REQUESTED" && !trimmedNote) {
      return NextResponse.json({ error: "A note is required when requesting changes" }, { status: 400 });
    }

    const now = new Date();

    const [video, comment] = await prisma.$transaction(async (tx) => {
      const updated = await tx.video.update({
        where: { id: vid },
        data: {
          approvalStatus: nextStatus as "APPROVED" | "CHANGES_REQUESTED",
          approvalUpdatedAt: now,
          approvalNote: trimmedNote || null,
        },
        select: { id: true, approvalStatus: true, approvalUpdatedAt: true, approvalNote: true },
      });

      let createdComment = null;
      if (trimmedNote) {
        createdComment = await tx.comment.create({
          data: {
            orgId,
            token: share.token,
            videoId: vid,
            timecodeMs: 0,
            body: trimmedNote,
            author: null,
            role: "CLIENT",
            isApprovalNote: true,
          },
          select: {
            id: true,
            timecodeMs: true,
            body: true,
            author: true,
            createdAt: true,
            parentId: true,
            role: true,
            status: true,
            isApprovalNote: true,
          },
        });
      }

      return [updated, createdComment];
    });

    const { galleryId, title } = await getOwnerVideoContext(vid);
    await sendOwnerWebhook({
      event: nextStatus === "APPROVED" ? "approved" : "changes_requested",
      orgId,
      videoId: vid,
      videoTitle: title,
      shareToken: share.token,
      ownerUrl: buildOwnerVideoUrl(new URL(req.url).origin, galleryId, vid),
      body: trimmedNote || null,
      timecodeMs: null,
      occurredAt: now.toISOString(),
    });

    return NextResponse.json({ ok: true, video, comment });
  } catch (err: any) {
    console.error("Set approval error:", err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
