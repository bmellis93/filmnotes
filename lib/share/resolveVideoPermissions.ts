// lib/share/resolveVideoPermissions.ts
import "server-only";

export type VideoPermissionOverride = {
  allowComments?: boolean;
  allowDownload?: boolean;
};

export type VideoPermissionOverrides = Record<string, VideoPermissionOverride>;

export function parseVideoPermissionOverrides(
  json: string | null | undefined
): VideoPermissionOverrides {
  if (!json) return {};
  try {
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};

    const out: VideoPermissionOverrides = {};
    for (const [videoId, raw] of Object.entries(obj as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const entry: VideoPermissionOverride = {};
      if (typeof r.allowComments === "boolean") entry.allowComments = r.allowComments;
      if (typeof r.allowDownload === "boolean") entry.allowDownload = r.allowDownload;
      if (Object.keys(entry).length > 0) out[videoId] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Effective comments/download permission for one video within a share --
 * an explicit per-video override wins; anything it doesn't set falls back
 * to the link's own allowComments/allowDownload.
 */
export function resolveVideoPermissions(
  linkAllowComments: boolean,
  linkAllowDownload: boolean,
  videoPermissionsJson: string | null | undefined,
  videoId: string
): { allowComments: boolean; allowDownload: boolean } {
  const override = parseVideoPermissionOverrides(videoPermissionsJson)[videoId];
  return {
    allowComments: override?.allowComments ?? linkAllowComments,
    allowDownload: override?.allowDownload ?? linkAllowDownload,
  };
}
