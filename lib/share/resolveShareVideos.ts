// lib/share/resolveShareVideos.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { buildChildToParent, type StackMap } from "@/components/domain/stacks";
import { parseAllowedIds, parseStacksForShare } from "@/lib/share/shareLinkUtils";

export type ShareVideoScope = {
  galleryId: string | null;
  videoId: string | null;
  allowedVideoIdsJson: string | null;
  stacksJson: string | null;
};

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
 * Live equivalent of parseAllowedIds/parseStacksForShare -- those read a
 * one-time snapshot taken when the link was created or last resent
 * (allowedVideoIdsJson/stacksJson on ShareLink), which goes stale the
 * moment a new version gets stacked onto an already-shared video, or a new
 * video gets added to an already-shared gallery. This recomputes both from
 * the gallery's current state on every read instead, so a share link never
 * needs a manual "refresh" action to catch up.
 *
 * - A gallery-wide share (galleryId set) resolves to every current
 *   non-archived READY video in that gallery, stack-expanded.
 * - A single-video share (only videoId set) resolves to just that video's
 *   own current stack -- new siblings in ITS stack show up automatically,
 *   but unrelated videos added elsewhere in the gallery don't leak into a
 *   link that was only ever scoped to one subject.
 * - A video with no gallery at all (orphaned) falls back to the frozen
 *   snapshot, since there's nothing live to compute from.
 */
export async function resolveShareVideos(
  share: ShareVideoScope
): Promise<{ allowedVideoIds: string[]; stacks: StackMap }> {
  let galleryId = share.galleryId;

  if (!galleryId && share.videoId) {
    const gv = await prisma.galleryVideo.findFirst({
      where: { videoId: share.videoId },
      select: { galleryId: true },
    });
    galleryId = gv?.galleryId ?? null;
  }

  if (!galleryId) {
    const allowedVideoIds = parseAllowedIds(share);
    return { allowedVideoIds, stacks: parseStacksForShare(share, allowedVideoIds) };
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { stacksJson: true },
  });

  if (!gallery) {
    const allowedVideoIds = parseAllowedIds(share);
    return { allowedVideoIds, stacks: parseStacksForShare(share, allowedVideoIds) };
  }

  const liveStacks = safeParseStacks(gallery.stacksJson);
  const childToParent = buildChildToParent(liveStacks);

  const rows = await prisma.galleryVideo.findMany({
    where: { galleryId, video: { deletedAt: null, archivedAt: null } },
    select: { video: { select: { id: true, status: true } } },
  });
  const readyIds = new Set(rows.filter((r) => r.video.status === "READY").map((r) => r.video.id));

  if (share.galleryId) {
    // Gallery-wide share: everything currently in the gallery, stack-expanded.
    const topLevelIds = new Set<string>();
    for (const id of readyIds) topLevelIds.add(childToParent.get(id) ?? id);

    const allowedVideoIds: string[] = [];
    const stacks: StackMap = {};
    for (const parentId of topLevelIds) {
      const members = (liveStacks[parentId] ?? [parentId]).filter((id) => readyIds.has(id));
      if (members.length === 0) continue;
      allowedVideoIds.push(...members);
      if (members.length > 1) stacks[parentId] = members;
    }
    return { allowedVideoIds, stacks };
  }

  // Single-video share: just this video's own current stack.
  const videoId = share.videoId!;
  const parentId = childToParent.get(videoId) ?? videoId;
  const members = (liveStacks[parentId] ?? [parentId]).filter((id) => readyIds.has(id));
  const allowedVideoIds = members.length > 0 ? members : [videoId];
  const stacks: StackMap = members.length > 1 ? { [parentId]: members } : {};
  return { allowedVideoIds, stacks };
}
