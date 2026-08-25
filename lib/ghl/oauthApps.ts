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
  return org?.appEdition === "PAID" ? getPaidAppConfig() : getPrivateAppConfig();
}
