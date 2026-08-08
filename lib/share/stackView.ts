// lib/share/stackView.ts
export type StackMap = Record<string, string[]>;

export function buildChildToParent(stacks: StackMap): Map<string, string> {
  const map = new Map<string, string>();
  for (const [parentId, ids] of Object.entries(stacks)) {
    for (const id of ids) {
      if (id !== parentId) map.set(id, parentId);
    }
  }
  return map;
}

/**
 * Returns the ordered stack (versions) for the currently viewed videoId.
 * - If videoId is a parent key, returns stacks[videoId]
 * - If videoId is inside some parent's stack array, returns that parent's array
 * - Else returns [videoId] (no stack)
 */
export function getStackIdsForVideo(
  videoId: string,
  stacks: StackMap,
  childToParent?: Map<string, string>
): string[] {
  const id = String(videoId || "").trim();
  if (!id) return [];

  if (stacks[id]?.length) return stacks[id];

  // Build lazily if the caller didn't supply one — most callers pass a
  // bare videoId that may be a child (non-parent) member of the stack,
  // and without this we'd silently fall back to a fake single-item stack.
  const map = childToParent ?? buildChildToParent(stacks);
  const parentId = map.get(id);
  if (parentId && stacks[parentId]) return stacks[parentId];

  return [id];
}

/**
 * Given current id, return the "next" id in the same stack array (if any).
 * If not in a stack or already last, returns null.
 */
export function getNextIdInStack(videoId: string, stacks: StackMap): string | null {
  const stack = getStackIdsForVideo(videoId, stacks);
  if (!stack.length) return null;

  const idx = stack.indexOf(videoId);
  if (idx === -1) return stack[0] ?? null;

  return idx < stack.length - 1 ? stack[idx + 1] : null;
}

/**
 * Used on server routes when you want "latest" behavior.
 * Assumes the last element of the stack is the newest.
 */
export function getLatestIdForVideo(videoId: string, stacks: StackMap): string {
  const stack = getStackIdsForVideo(videoId, stacks);
  return stack.length ? stack[stack.length - 1] : videoId;
}