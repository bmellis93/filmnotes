// lib/embed/constants.ts
// Shared between app/embed/page.tsx (which mints/stores the token after
// the SSO handshake) and components/embed/useEmbedSession.ts (which every
// other embed page reads it back from).
export const EMBED_TOKEN_STORAGE_KEY = "rm_embed_token";
