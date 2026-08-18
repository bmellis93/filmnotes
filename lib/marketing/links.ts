// Central place for marketing-site CTA destinations, so "get the app" links
// only need updating in one spot.

// Sends the visitor straight into the GHL "choose location" install/authorize
// flow (same route /login's "Connect HighLevel" button uses) — this builds
// the marketplace OAuth URL server-side with CSRF nonce protection, rather
// than hardcoding client_id/redirect_uri in marketing pages.
export const GET_APP_URL = "/api/auth/oauth/start?next=/owner/galleries";

export const LOGIN_URL = "/login";
