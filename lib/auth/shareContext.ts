// lib/auth/shareContext.ts
import "server-only";
import { NextRequest } from "next/server";
import { loadGatedShare } from "@/lib/share/shareGate";
import { unlockCookieName } from "@/lib/share/sharePassword";
import { resolveShareVideos } from "@/lib/share/resolveShareVideos";

export type ShareContext =
  | {
      kind: "share";
      token: string;
      orgId: string;
      videoIds: string[];
      galleryId?: string | null;
      allowDownload?: boolean;
      allowComments?: boolean;
      view?: "VIEW_ONLY" | "REVIEW_DOWNLOAD";
    }
  | null;

/**
 * Look for a share token in:
 * - ?token=...
 * - x-share-token header
 * - rm_share_token cookie (optional)
 */
function getTokenFromRequest(req: NextRequest) {
  const fromQuery = req.nextUrl.searchParams.get("token");
  if (fromQuery) return fromQuery;

  const fromHeader = req.headers.get("x-share-token");
  if (fromHeader) return fromHeader;

  const fromCookie = req.cookies.get("rm_share_token")?.value;
  if (fromCookie) return fromCookie;

  return null;
}

export async function getShareContextFromRequest(req: NextRequest): Promise<ShareContext> {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  // Delegates to the same revoked/expired/password gate every other share
  // consumer uses -- this used to be a bare, unguarded findFirst that never
  // checked revoked/expired at all, a pre-existing gap fixed by this shared
  // path (see lib/share/shareGate.ts).
  const unlockProof = req.cookies.get(unlockCookieName(token))?.value ?? null;
  const gate = await loadGatedShare(token, unlockProof);
  if (!gate.ok) return null;

  const link = gate.share;
  const { allowedVideoIds: videoIds } = await resolveShareVideos(link);
  if (videoIds.length === 0) return null;

  return {
    kind: "share",
    token: link.token,
    orgId: link.orgId,
    videoIds,
    galleryId: link.galleryId ?? null,
    allowDownload: Boolean(link.allowDownload),
    allowComments: Boolean(link.allowComments),
    view: link.view === "VIEW_ONLY" ? "VIEW_ONLY" : "REVIEW_DOWNLOAD",
  };
}