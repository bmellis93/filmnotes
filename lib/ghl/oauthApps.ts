import "server-only";
import type { AppEdition } from "@prisma/client";

export type GhlAppConfig = {
  edition: AppEdition;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  apiBaseUrl: string;
  scopes: string;
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
    clientId: mustEnv("GHL_CLIENT_ID"),
    clientSecret: mustEnv("GHL_CLIENT_SECRET"),
    redirectUri: mustEnv("GHL_REDIRECT_URI"),
    authorizeUrl: mustEnv("GHL_AUTHORIZE_URL"),
    apiBaseUrl: mustEnv("GHL_API_BASE_URL"),
    scopes: process.env.GHL_SCOPES || "locations.read",
  };
}

// The public/paid GHL Marketplace app -- filmnotes.app/api/auth/oauth/callback/paid.
// Shares the same GHL_AUTHORIZE_URL/GHL_API_BASE_URL (those are generic GHL
// endpoints, not per-app) but has its own client id/secret/redirect/scopes.
export function getPaidAppConfig(): GhlAppConfig {
  return {
    edition: "PAID",
    clientId: mustEnv("GHL_PAID_CLIENT_ID"),
    clientSecret: mustEnv("GHL_PAID_CLIENT_SECRET"),
    redirectUri: mustEnv("GHL_PAID_REDIRECT_URI"),
    authorizeUrl: mustEnv("GHL_AUTHORIZE_URL"),
    apiBaseUrl: mustEnv("GHL_API_BASE_URL"),
    scopes: process.env.GHL_PAID_SCOPES || "locations.read",
  };
}
