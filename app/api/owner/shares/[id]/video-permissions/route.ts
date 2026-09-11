// app/api/owner/shares/[id]/video-permissions/route.ts
//
// Sets or clears one video's permission override within a gallery share.
// Body: { videoId, allowComments?: boolean, allowDownload?: boolean } to
// set (only the keys provided are touched -- the other stays whatever it
// already was), or { videoId, reset: true } to drop the override entirely
// and fall back to the link's own allowComments/allowDownload.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { parseVideoPermissionOverrides, resolveVideoPermissions } from "@/lib/share/resolveVideoPermissions";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "CONTRIBUTOR");
    const { orgId } = ctx;
    const { id } = await params;

    const share = await prisma.shareLink.findFirst({
      where: { id, orgId },
      select: { id: true, allowComments: true, allowDownload: true, videoPermissionsJson: true },
    });

    if (!share) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}) as any);
    const videoId = String(body?.videoId || "").trim();
    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const overrides = parseVideoPermissionOverrides(share.videoPermissionsJson);

    if (body?.reset === true) {
      delete overrides[videoId];
    } else {
      const entry = { ...(overrides[videoId] ?? {}) };
      if (typeof body?.allowComments === "boolean") entry.allowComments = body.allowComments;
      if (typeof body?.allowDownload === "boolean") entry.allowDownload = body.allowDownload;
      if (Object.keys(entry).length === 0) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }
      overrides[videoId] = entry;
    }

    await prisma.shareLink.update({
      where: { id: share.id },
      data: { videoPermissionsJson: JSON.stringify(overrides) },
    });

    const perms = resolveVideoPermissions(
      share.allowComments,
      share.allowDownload,
      JSON.stringify(overrides),
      videoId
    );

    return NextResponse.json({
      ok: true,
      video: { id: videoId, ...perms, hasOverride: Boolean(overrides[videoId]) },
    });
  } catch (err: any) {
    console.error("Set share video permission error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}
