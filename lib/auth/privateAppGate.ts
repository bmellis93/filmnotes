// lib/auth/privateAppGate.ts
//
// Shared gate for the private app's key-gated routes (/private/login,
// /private/install, and their backing API routes). Accepts the secret
// either as a ?key= query param or as a long-lived httpOnly cookie, so a
// bookmark can just be the clean path (e.g. filmnotes.app/private/login)
// once the cookie's been set -- the secret never has to live in a visible
// URL/bookmark/browser history after the first visit.
import "server-only";
import crypto from "crypto";

export const PRIVATE_GATE_COOKIE_NAME = "rm_private_gate";
export const PRIVATE_GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isValidPrivateKey(candidate: string | null | undefined): boolean {
  const secret = process.env.PRIVATE_APP_LOGIN_SECRET;
  return Boolean(secret && candidate && safeEqual(candidate, secret));
}

/** Cookie options shared by every route that sets/refreshes the gate cookie. */
export function privateGateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: PRIVATE_GATE_COOKIE_MAX_AGE,
  };
}
