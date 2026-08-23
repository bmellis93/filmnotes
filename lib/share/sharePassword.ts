// lib/share/sharePassword.ts
import "server-only";
import crypto from "crypto";

const SCRYPT_KEYLEN = 64;

// No bcrypt/argon2 dependency in this app -- Node's built-in scrypt (already
// the pattern used elsewhere here for constant-time comparison, e.g. the Mux
// webhook signature check) is enough for share-link passwords.
export function hashSharePassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifySharePasswordHash(password: string, stored: string): boolean {
  const [scheme, salt, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;

  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hashHex, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export function unlockCookieName(token: string): string {
  return `rm_share_unlock_${token}`;
}

function unlockSecret(): string {
  const secret = process.env.APP_JWT_SECRET;
  if (!secret) throw new Error("Missing APP_JWT_SECRET");
  return secret;
}

// The unlock proof embeds the share's current passwordHash, so changing the
// password automatically invalidates every previously-issued cookie (the
// HMAC no longer matches) with no separate revocation bookkeeping needed.
export function computeUnlockProof(token: string, passwordHash: string): string {
  return crypto.createHmac("sha256", unlockSecret()).update(`${token}:${passwordHash}`).digest("hex");
}

export function verifyUnlockProof(
  proof: string | null | undefined,
  token: string,
  passwordHash: string
): boolean {
  if (!proof) return false;

  const expected = computeUnlockProof(token, passwordHash);
  const a = Buffer.from(proof, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

// Cookie lifetime for the "remember this password" unlock proof -- capped to
// the share's own expiry if that's sooner, so the cookie never outlives the
// link it unlocks.
export function unlockCookieMaxAgeSeconds(expiresAt: Date | null): number {
  if (!expiresAt) return THIRTY_DAYS_SECONDS;
  const secondsUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return Math.max(0, Math.min(THIRTY_DAYS_SECONDS, secondsUntilExpiry));
}
