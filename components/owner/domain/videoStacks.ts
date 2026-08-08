// /components/owner/domain/videoStacks.ts
import type { GalleryVideo } from "@/components/owner/VideoGrid";
import type { StackMap, ChildToParentMap } from "@/components/domain/stacks";
import {
  buildChildToParent as buildChildToParentShared,
  latestIdForCard as latestIdForCardShared,
  sanitizeStacks,
} from "@/components/domain/stacks";

export type { StackMap }; // re-export for owner callers (same type)

export type MenuAction = "MANAGE_VERSIONS" | "UNSTACK";

export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function buildById(videos: GalleryVideo[]) {
  return new Map(videos.map((v) => [v.id, v]));
}

/**
 * Owner domain uses the shared implementation so it never drifts from share/client behavior.
 * Typed return included.
 */
export function buildChildToParent(stacks: StackMap): ChildToParentMap {
  return buildChildToParentShared(sanitizeStacks(stacks));
}

export function getParentId(id: string, childToParent: ChildToParentMap) {
  return childToParent.get(id) ?? id;
}

export function getStackIds(parentId: string, stacks: StackMap) {
  const s = sanitizeStacks(stacks);
  return s[parentId] ?? [parentId];
}

export function isStackParent(id: string, stacks: StackMap) {
  const s = sanitizeStacks(stacks);
  return Boolean(s[id] && s[id].length >= 2);
}

export function isHiddenChild(id: string, childToParent: ChildToParentMap) {
  return childToParent.has(id);
}

export function getVisibleVideos(videos: GalleryVideo[], stacks: StackMap) {
  const childToParent = buildChildToParent(stacks);
  return videos.filter((v) => !isHiddenChild(v.id, childToParent));
}

export function canStackVideo(v: GalleryVideo | undefined) {
  return Boolean(v && v.status === "READY");
}

/**
 * Shared "latest" logic (single source of truth).
 */
export function latestIdForCard(
  cardId: string,
  stacks: StackMap,
  childToParent: ChildToParentMap
) {
  return latestIdForCardShared(cardId, sanitizeStacks(stacks), childToParent);
}

/**
 * Pure helper: validates and returns a new StackMap, or null if invalid.
 * - parent is orderedIds[0]
 * - requires >= 2 resolved videos
 * - all videos must be READY
 * - removes any existing stacks that involve any of these IDs (to avoid duplication)
 */
export function nextStacksFromOrder(args: {
  orderedIds: string[];
  videos: GalleryVideo[];
  stacks: StackMap;
}): { nextStacks: StackMap; parentId: string; stackIds: string[] } | null {
  const { orderedIds, videos } = args;
  const stacks = sanitizeStacks(args.stacks);

  const cleanIds = unique(orderedIds).filter(Boolean);
  if (cleanIds.length < 2) return null;

  const byId = buildById(videos);
  const resolved = cleanIds.map((id) => byId.get(id)).filter(Boolean) as GalleryVideo[];
  if (resolved.length < 2) return null;
  if (resolved.some((v) => v.status !== "READY")) return null;

  const parentId = resolved[0].id;
  const stackIds = resolved.map((v) => v.id);

  // Remove existing stacks that contain any of these IDs (either as parent or child)
  const childToParent = buildChildToParent(stacks);
  const involvedParents = new Set<string>();
  for (const id of stackIds) involvedParents.add(getParentId(id, childToParent));

  const next: StackMap = {};
  for (const [pid, ids] of Object.entries(stacks)) {
    if (!involvedParents.has(pid)) next[pid] = ids;
  }

  next[parentId] = stackIds;
  return { nextStacks: next, parentId, stackIds };
}

/**
 * Pure helper: merges source stack into target stack (target stays v1),
 * returning an orderedIds list you can feed into nextStacksFromOrder().
 */
export function mergeStacksForDnD(args: {
  sourceId: string;
  targetId: string;
  stacks: StackMap;
  videos: GalleryVideo[];
}): string[] | null {
  const { sourceId, targetId, videos } = args;
  const stacks = sanitizeStacks(args.stacks);

  const byId = buildById(videos);
  const childToParent = buildChildToParent(stacks);

  const srcParent = getParentId(sourceId, childToParent);
  const tgtParent = getParentId(targetId, childToParent);
  if (srcParent === tgtParent) return null;

  const src = byId.get(sourceId);
  const tgt = byId.get(targetId);
  if (!canStackVideo(src) || !canStackVideo(tgt)) return null;

  const srcStack = getStackIds(srcParent, stacks);
  const tgtStack = getStackIds(tgtParent, stacks);

  return unique([...tgtStack, ...srcStack]);
}

/**
 * Pure helper: unstack and (optionally) reinsert versions right after parent in the grid order.
 * Returns { nextVideos, nextStacks } or null if not a real stack.
 */
export function unstackPreserveOrder(args: {
  parentId: string;
  videos: GalleryVideo[];
  stacks: StackMap;
}) {
  const { parentId, videos } = args;
  const stacks = sanitizeStacks(args.stacks);

  const ids = stacks[parentId];
  if (!ids || ids.length < 2) return null;

  const byId = buildById(videos);
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as GalleryVideo[];
  if (!ordered.length) return null;

  const setIds = new Set(ids);

  // Remove all stack ids
  const without = videos.filter((v) => !setIds.has(v.id));

  // Find where the parent ended up. If every video in the gallery was part
  // of this stack, `without` is empty and there's nothing to anchor to —
  // just place the unstacked videos at the front in that case.
  const parentIdx = without.findIndex((v) => v.id === parentId);

  const head = parentIdx === -1 ? [] : without.slice(0, parentIdx + 1);
  const tail = parentIdx === -1 ? without : without.slice(parentIdx + 1);

  const rest = ordered.filter((v) => v.id !== parentId);

  const nextVideos =
    parentIdx === -1 ? [...ordered, ...tail] : [...head, ...rest, ...tail];
  const nextStacks: StackMap = { ...stacks };
  delete nextStacks[parentId];

  return { nextVideos, nextStacks, stackIds: ids };
}