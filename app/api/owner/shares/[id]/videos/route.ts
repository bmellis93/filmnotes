// app/api/owner/shares/[id]/videos/route.ts
//
// Powers the expanded per-video view in Manage Links (ManageSharesModal) --
// the current video list this share actually shows (live, via
// resolveShareVideos) along with each video's effective comments/download
// permission and whether that's a per-video override or just the link's
// own default.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { resolveShareVideos } from "@/lib/share/resolveShareVideos";
import { parseVideoPermissionOverrides, resolveVideoPermissions } from "@/lib/share/resolveVideoPermissions";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "VIEWER");
    const { orgId } = ctx;
    const { id } = await params;

    const share = await prisma.shareLink.findFirst({
      where: { id, orgId },
      select: {
        galleryId: true,
        videoId: true,
        allowedVideoIdsJson: true,
        stacksJson: true,
        allowComments: true,
        allowDownload: true,
        videoPermissionsJson: true,
      },
    });

    if (!share) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { allowedVideoIds } = await resolveShareVideos(share);
    const overrides = parseVideoPermissionOverrides(share.videoPermissionsJson);

    const rows = await prisma.video.findMany({
      where: { id: { in: allowedVideoIds } },
      select: { id: true, title: true, thumbnailUrl: true },
    });
    const byId = new Map(rows.map((v) => [v.id, v]));

    const videos = allowedVideoIds
      .map((videoId) => {
        const v = byId.get(videoId);
        if (!v) return null;
        const perms = resolveVideoPermissions(
          share.allowComments,
          share.allowDownload,
          share.videoPermissionsJson,
          videoId
        );
        return {
          id: videoId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          allowComments: perms.allowComments,
          allowDownload: perms.allowDownload,
          hasOverride: Boolean(overrides[videoId]),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ ok: true, videos });
  } catch (err: any) {
    console.error("List share videos error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}
