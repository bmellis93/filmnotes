// app/api/owner/galleries/update-stacks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import type { StackMap } from "@/components/domain/stacks";

export const runtime = "nodejs";

type Body = {
  galleryId: string;
  stacks: StackMap; // full stacks map: { [parentId]: string[] }
  orderedIds?: string[]; // optional, but recommended
};

function safeString(x: unknown): string {
  return String(x ?? "").trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOwnerContext(); // { orgId, userId, role }
    requireRole(ctx, "CONTRIBUTOR");

    const json = (await req.json()) as Partial<Body>;

    const galleryId = safeString(json.galleryId);
    if (!galleryId) {
      return NextResponse.json({ error: "galleryId is required" }, { status: 400 });
    }

    const stacksRaw = json.stacks ?? {};
    if (!isPlainObject(stacksRaw)) {
      return NextResponse.json({ error: "stacks must be an object" }, { status: 400 });
    }
    const stacks = stacksRaw as StackMap;

    const orderedIds = Array.isArray(json.orderedIds)
      ? json.orderedIds.map((id) => safeString(id)).filter(Boolean)
      : [];

    // 1) Verify gallery belongs to org
    const gallery = await prisma.gallery.findUnique({
      where: { id: galleryId },
      select: { id: true, orgId: true },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }
    if (gallery.orgId !== ctx.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2) Allowed videoIds for this gallery (org-scoped)
    const rows = await prisma.galleryVideo.findMany({
      where: { galleryId },
      select: { videoId: true },
    });
    const allowed = new Set(rows.map((r) => r.videoId));

    // 3) Validate orderedIds
    for (const id of orderedIds) {
      if (!allowed.has(id)) {
        return NextResponse.json(
          { error: `orderedIds contains a videoId not in this gallery: ${id}` },
          { status: 400 }
        );
      }
    }

    // 4) Validate stacks
    for (const entry of Object.entries(stacks) as Array<[string, unknown]>) {
      const parentId = safeString(entry[0]);
      const children = entry[1];

      if (!parentId) continue;

      if (!allowed.has(parentId)) {
        return NextResponse.json(
          { error: `stacks contains a parentId not in this gallery: ${parentId}` },
          { status: 400 }
        );
      }

      if (!Array.isArray(children)) {
        return NextResponse.json(
          { error: `stacks[${parentId}] must be an array` },
          { status: 400 }
        );
      }

      for (const rawChild of children) {
        const childId = safeString(rawChild);
        if (!childId) continue;

        if (!allowed.has(childId)) {
          return NextResponse.json(
            { error: `stacks[${parentId}] contains a videoId not in this gallery: ${childId}` },
            { status: 400 }
          );
        }
      }
    }

    // 5) Persist stacksJson + sortOrder
    await prisma.$transaction(async (tx) => {
      await tx.gallery.update({
        where: { id: galleryId },
        data: { stacksJson: JSON.stringify(stacks ?? {}) },
      });

      if (orderedIds.length > 0) {
        // set the visible/parent order exactly as sent by UI
        await Promise.all(
          orderedIds.map((videoId: string, index: number) =>
            tx.galleryVideo.updateMany({
              where: { galleryId, videoId },
              data: { sortOrder: index },
            })
          )
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("update-stacks error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}