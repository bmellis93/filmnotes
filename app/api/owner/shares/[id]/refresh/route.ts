// app/api/owner/shares/[id]/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { buildChildToParent, type StackMap } from "@/components/domain/stacks";
import { parseAllowedIds } from "@/lib/share/shareLinkUtils";

export const runtime = "nodejs";

function safeParseStacks(json: string | null | undefined): StackMap {
  if (!json) return {};
  try {
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? (obj as StackMap) : {};
  } catch {
    return {};
  }
}

/**
 * Re-syncs an existing gallery ShareLink's allowedVideoIdsJson/stacksJson
 * against the gallery's CURRENT state, without touching the contact,
 * token, or sending any notification.
 *
 * Why this exists: allowedVideoIdsJson/stacksJson are snapshotted once at
 * share-creation (or resend) time -- see create-gallery/route.ts. Adding a
 * new version to an already-shared video's stack later never reaches an
 * already-issued link, so the client can be stuck seeing only v1 forever
 * with no way for the owner to fix it short of re-sending (which re-
 * notifies the client) or hand-editing the database. This gives the owner
 * a way to just resync the data.
 *
 * Deliberately does NOT add videos to the allowed set that weren't already
 * shared -- only expands each already-shared subject to its current full
 * stack (so a brand-new, unrelated video added to the gallery doesn't leak
 * into an old curated link), and drops any id that's since been archived,
 * deleted, or removed from the gallery entirely.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "CONTRIBUTOR");
    const { orgId } = ctx;
    const { id } = await params;

    const share = await prisma.shareLink.findFirst({
      where: { id, orgId },
      select: { id: true, galleryId: true, videoId: true, allowedVideoIdsJson: true },
    });

    if (!share) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // A single-video share has nothing to resync -- there's no gallery
    // stack for it to pick up (see create/route.ts, which never sets
    // allowedVideoIdsJson/stacksJson for video-only shares).
    let galleryId = share.galleryId;
    if (!galleryId && share.videoId) {
      const gv = await prisma.galleryVideo.findFirst({
        where: { videoId: share.videoId },
        select: { galleryId: true },
      });
      galleryId = gv?.galleryId ?? null;
    }

    if (!galleryId) {
      return NextResponse.json(
        { error: "This link isn't tied to a gallery, so there's nothing to refresh." },
        { status: 400 }
      );
    }

    const gallery = await prisma.gallery.findFirst({
      where: { id: galleryId, orgId, deletedAt: null },
      select: { stacksJson: true },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    const validVideoRows = await prisma.galleryVideo.findMany({
      where: { galleryId, video: { deletedAt: null, archivedAt: null } },
      select: { videoId: true },
    });
    const validVideoIds = new Set(validVideoRows.map((r) => r.videoId));

    const liveStacks = safeParseStacks(gallery.stacksJson);
    const childToParent = buildChildToParent(liveStacks);
    const originalAllowed = parseAllowedIds(share);

    const newAllowed = new Set<string>();
    const newStacks: StackMap = {};

    for (const rawId of originalAllowed) {
      if (!validVideoIds.has(rawId)) continue; // dropped/archived since sharing

      const parentId = childToParent.get(rawId) ?? rawId;
      const members = liveStacks[parentId];

      if (members) {
        const liveMembers = members.filter((m) => validVideoIds.has(m));
        if (liveMembers.length > 0) {
          for (const m of liveMembers) newAllowed.add(m);
          newStacks[parentId] = liveMembers;
        } else {
          newAllowed.add(rawId);
        }
      } else {
        newAllowed.add(rawId);
      }
    }

    const allowedVideoIds = Array.from(newAllowed);

    if (allowedVideoIds.length === 0) {
      return NextResponse.json(
        { error: "None of this link's videos still exist in the gallery." },
        { status: 400 }
      );
    }

    await prisma.shareLink.update({
      where: { id: share.id },
      data: {
        allowedVideoIdsJson: JSON.stringify(allowedVideoIds),
        stacksJson: JSON.stringify(newStacks),
      },
    });

    return NextResponse.json({ ok: true, videoCount: allowedVideoIds.length });
  } catch (err: any) {
    console.error("Refresh share error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}
