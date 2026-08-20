// Central place for marketing-site CTA destinations, so "get the app" links
// only need updating in one spot.

// Sends the visitor straight into the GHL "choose location" install/authorize
// flow for the public/paid Marketplace app (lib/ghl/oauthApps.ts's
// getPaidAppConfig) — this builds the OAuth URL server-side with CSRF nonce
// protection, rather than hardcoding client_id/redirect_uri in marketing
// pages. Distinct from /login's "Connect HighLevel" button, which is for
// existing owners signing back in and still targets the private app.
export const GET_APP_URL = "/api/auth/oauth/start/paid?next=/owner/galleries";

export const LOGIN_URL = "/login";
