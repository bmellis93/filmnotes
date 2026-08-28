// lib/embed/constants.ts
// Shared between app/embed/page.tsx (which mints/stores the token after
// the SSO handshake) and components/embed/useEmbedSession.ts (which every
// other embed page reads it back from).
export const EMBED_TOKEN_STORAGE_KEY = "rm_embed_token";

// Absolute expiry (epoch ms) of the token above, from the SSO response's
// `expiresAt` -- lets useEmbedSession schedule its refresh relative to the
// token's real remaining lifetime instead of a fixed offset from whenever it
// happens to mount (every embed page mounts it independently).
export const EMBED_TOKEN_EXPIRES_AT_STORAGE_KEY = "rm_embed_token_expires_at";

// Single source of truth for the embed bearer token's lifetime -- used both
// to sign it (app/api/ghl/sso/route.ts) and to schedule useEmbedSession's
// silent background refresh, so the two can never drift out of sync.
export const EMBED_TOKEN_TTL_SECONDS = 15 * 60;
