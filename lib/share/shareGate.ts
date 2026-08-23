// lib/share/shareGate.ts
import "server-only";
import type { ShareLink } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyUnlockProof } from "@/lib/share/sharePassword";

// Single source of truth for "is this share link currently valid" --
// revoked/expired/password, in that order. requireValidShareToken,
// fetchShare, the /api/shares/resolve route, and getShareContextFromRequest
// all delegate here instead of each duplicating this logic (they used to,
// and one of them -- getShareContextFromRequest -- had never checked
// revoked/expired at all as a result of that duplication).
export type ShareGateResult =
  | { ok: true; share: ShareLink }
  | { ok: false; status: number; error: string; passwordRequired?: true };

export async function loadGatedShare(
  token: string,
  unlockProof: string | null
): Promise<ShareGateResult> {
  const t = String(token || "").trim();
  if (!t) return { ok: false, status: 400, error: "Missing token" };

  const share = await prisma.shareLink.findUnique({ where: { token: t } });
  if (!share) return { ok: false, status: 404, error: "Invalid token" };

  if (share.revokedAt) {
    return { ok: false, status: 410, error: "Link revoked" };
  }

  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 410, error: "Link expired" };
  }

  if (share.passwordHash) {
    const unlocked = verifyUnlockProof(unlockProof, share.token, share.passwordHash);
    if (!unlocked) {
      return { ok: false, status: 401, error: "Password required", passwordRequired: true };
    }
  }

  return { ok: true, share };
}
