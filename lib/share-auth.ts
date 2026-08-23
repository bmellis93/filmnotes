// /lib/share-auth.ts
import type { ShareLink } from "@prisma/client";
import { loadGatedShare } from "@/lib/share/shareGate";

export type ShareAuthResult =
  | { ok: true; share: ShareLink }
  | { ok: false; status: number; error: string; passwordRequired?: true };

export async function requireValidShareToken(
  token: string,
  unlockProof?: string | null
): Promise<ShareAuthResult> {
  return loadGatedShare(token, unlockProof ?? null);
}
