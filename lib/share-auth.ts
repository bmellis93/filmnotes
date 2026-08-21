// /lib/share-auth.ts
import { prisma } from "@/lib/prisma";
import type { ShareLink } from "@prisma/client";

export type ShareAuthResult =
  | { ok: true; share: ShareLink }
  | { ok: false; status: number; error: string };

export async function requireValidShareToken(token: string): Promise<ShareAuthResult> {
  const t = String(token || "").trim();
  if (!t) return { ok: false, status: 400, error: "Missing token" };

  const share = await prisma.shareLink.findUnique({
    where: { token: t },
  });

  if (!share) return { ok: false, status: 404, error: "Invalid token" };

  if (share.revokedAt) {
    return { ok: false, status: 410, error: "Link revoked" };
  }

  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 410, error: "Link expired" };
  }

  return { ok: true, share };
}