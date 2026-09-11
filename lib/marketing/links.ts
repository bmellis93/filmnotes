// Central place for marketing-site CTA destinations, so "get the app" links
// only need updating in one spot.

// Sends the visitor straight into the GHL "choose location" install/authorize
// flow for the public/paid Marketplace app (lib/ghl/oauthApps.ts's
// getPaidAppConfig) — this builds the OAuth URL server-side with CSRF nonce
// protection, rather than hardcoding client_id/redirect_uri in marketing
// pages. Distinct from /login (also public, offers the same paid/agency
// reconnect this does) -- that page exists for requireOwnerContext() to
// redirect a returning customer to on an expired session, not as a CTA, so
// it's not linked from marketing nav either. Also distinct from
// /private/login, Ben's own key-gated entry point into the private app.
export const GET_APP_URL = "/api/auth/oauth/start/paid?next=/owner/galleries";

// Same idea as GET_APP_URL, but for the Agency-only-distribution Marketplace
// app (lib/ghl/oauthApps.ts's getAgencyAppConfig) -- only ever reachable by
// an agency admin in the first place, but linked separately so the pricing
// page's agency toggle sends people to the right install flow.
export const GET_AGENCY_APP_URL = "/api/auth/oauth/start/agency?next=/owner/galleries";
