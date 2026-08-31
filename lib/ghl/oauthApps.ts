import "server-only";
import type { AppEdition } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GhlAppConfig = {
  edition: AppEdition;
  appId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  apiBaseUrl: string;
  scopes: string;
  /**
   * Ties the OAuth authorize request to this app's published Marketplace
   * listing. Required for monetized/paid apps -- omitting it makes GHL treat
   * the request as a bare OAuth call rather than a Marketplace install, which
   * paid apps reject with "must be installed through the marketplace".
   * Copy the `version_id` query param off the app's whitelabel/install link
   * in the dev portal's Marketplace listing settings.
   */
  versionId?: string;
  /**
   * The "Storage Overage" Custom Event billing meter's id for this app.
   * Meters are opaque and scoped to a single Marketplace app registration
   * (like plan ids), so each paid/agency app needs its own even though they
   * charge for the same thing -- see chargeStorageOverage in
   * lib/ghl/billing.ts, which raises the Wallet Charge under whichever app
   * installed the org. Undefined for editions that are never billed.
   */
  storageOverageMeterId?: string;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

// The private/free GHL app -- filmnotes.app/api/auth/oauth/callback.
export function getPrivateAppConfig(): GhlAppConfig {
  return {
    edition: "PRIVATE",
    appId: mustEnv("GHL_APP_ID"),
    clientId: mustEnv("GHL_CLIENT_ID"),
    clientSecret: mustEnv("GHL_CLIENT_SECRET"),
    redirectUri: mustEnv("GHL_REDIRECT_URI"),
    authorizeUrl: mustEnv("GHL_AUTHORIZE_URL"),
    apiBaseUrl: mustEnv("GHL_API_BASE_URL"),
    scopes: process.env.GHL_SCOPES || "locations.read",
  };
}

// The public/paid GHL Marketplace app -- filmnotes.app/api/auth/oauth/callback/paid.
// Shares GHL_API_BASE_URL with the private app (generic GHL endpoint, not
// per-app), but has its own client id/secret/redirect/scopes/authorize URL --
// paid-app installs must be tied to the Marketplace listing via versionId
// (see GhlAppConfig), which the private app has no listing for and doesn't
// need. GHL_PAID_AUTHORIZE_URL falls back to GHL_AUTHORIZE_URL since in
// practice they're the same host; override it if the dev portal's whitelabel
// link for this app ever points somewhere else.
export function getPaidAppConfig(): GhlAppConfig {
  return {
    edition: "PAID",
    appId: mustEnv("GHL_PAID_APP_ID"),
    clientId: mustEnv("GHL_PAID_CLIENT_ID"),
    clientSecret: mustEnv("GHL_PAID_CLIENT_SECRET"),
    redirectUri: mustEnv("GHL_PAID_REDIRECT_URI"),
    authorizeUrl: process.env.GHL_PAID_AUTHORIZE_URL || mustEnv("GHL_AUTHORIZE_URL"),
    apiBaseUrl: mustEnv("GHL_API_BASE_URL"),
    scopes: process.env.GHL_PAID_SCOPES || "locations.read",
    versionId: mustEnv("GHL_PAID_APP_VERSION_ID"),
    storageOverageMeterId: mustEnv("GHL_STORAGE_OVERAGE_METER_ID"),
  };
}

// The agency-tier GHL Marketplace app -- filmnotes.app/api/auth/oauth/callback/agency.
// A distinct Marketplace listing (own client id/secret/version/meter/plan
// ids) restricted to Agency-only distribution in the dev portal, so
// individual sub-account owners can never see or install it -- see the
// pricing discussion this was built from. Otherwise mirrors the paid app.
export function getAgencyAppConfig(): GhlAppConfig {
  return {
    edition: "AGENCY",
    appId: mustEnv("GHL_AGENCY_APP_ID"),
    clientId: mustEnv("GHL_AGENCY_CLIENT_ID"),
    clientSecret: mustEnv("GHL_AGENCY_CLIENT_SECRET"),
    redirectUri: mustEnv("GHL_AGENCY_REDIRECT_URI"),
    authorizeUrl: process.env.GHL_AGENCY_AUTHORIZE_URL || mustEnv("GHL_AUTHORIZE_URL"),
    apiBaseUrl: mustEnv("GHL_API_BASE_URL"),
    scopes: process.env.GHL_AGENCY_SCOPES || "locations.read",
    versionId: mustEnv("GHL_AGENCY_APP_VERSION_ID"),
    storageOverageMeterId: mustEnv("GHL_AGENCY_STORAGE_OVERAGE_METER_ID"),
  };
}

/**
 * Resolves which app's credentials govern a given org -- the single place
 * refresh (lib/ghl/client.ts) and billing (lib/ghl/billing.ts) should go for
 * "which client_id/secret/appId applies here", instead of each hardcoding
 * the private app's. Falls back to PRIVATE for orgs with no appEdition row
 * (shouldn't happen -- the column has a DB default -- but fail toward the
 * app that's never billed rather than toward one that charges money).
 */
export async function getAppConfigForOrg(orgId: string): Promise<GhlAppConfig> {
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { appEdition: true } });
  if (org?.appEdition === "PAID") return getPaidAppConfig();
  if (org?.appEdition === "AGENCY") return getAgencyAppConfig();
  return getPrivateAppConfig();
}
