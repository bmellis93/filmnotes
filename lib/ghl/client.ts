import "server-only";
import { prisma } from "@/lib/prisma";

const GHL_BASE_URL = process.env.GHL_API_BASE_URL!;

// Refresh a bit before actual expiry so an in-flight request never races the clock.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// De-dupe concurrent refreshes for the same org within one server process
// (GHL refresh tokens rotate on use, so two simultaneous refreshes would race).
const inflightRefreshes = new Map<string, Promise<string>>();

async function refreshAccessToken(orgId: string, refreshToken: string): Promise<string> {
  const clientId = mustEnv("GHL_CLIENT_ID");
  const clientSecret = mustEnv("GHL_CLIENT_SECRET");

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("refresh_token", refreshToken);

  const res = await fetch(`${GHL_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    throw new Error(`GHL token refresh failed for org ${orgId} (${res.status}): ${JSON.stringify(json)}`);
  }

  const expiresAt =
    typeof json.expires_in === "number" && json.expires_in > 0
      ? new Date(Date.now() + json.expires_in * 1000)
      : null;

  await prisma.installation.update({
    where: { orgId },
    data: {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? refreshToken,
      ...(expiresAt ? { expiresAt } : {}),
    },
  });

  return json.access_token as string;
}

function refreshAccessTokenDeduped(orgId: string, refreshToken: string): Promise<string> {
  const existing = inflightRefreshes.get(orgId);
  if (existing) return existing;

  const p = refreshAccessToken(orgId, refreshToken).finally(() => {
    inflightRefreshes.delete(orgId);
  });
  inflightRefreshes.set(orgId, p);
  return p;
}

export async function getGhlAccessToken(orgId: string) {
  const inst = await prisma.installation.findUnique({
    where: { orgId },
    select: { accessToken: true, refreshToken: true, expiresAt: true },
  });
  if (!inst) throw new Error(`No GHL installation found for org ${orgId}`);
  if (!inst.accessToken) throw new Error(`GHL installation missing access token for org ${orgId}`);

  const isExpiringSoon =
    inst.expiresAt != null && inst.expiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;

  if (isExpiringSoon && inst.refreshToken) {
    try {
      return await refreshAccessTokenDeduped(orgId, inst.refreshToken);
    } catch (err) {
      // Fall back to the existing token rather than hard-failing the whole request;
      // GHL will reject it with a clear 401 if it's truly expired.
      console.error(err);
    }
  }

  return inst.accessToken;
}

export function ghlHeaders(accessToken: string) {
  return Object.freeze({
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    Version: "2021-07-28",
  });
}