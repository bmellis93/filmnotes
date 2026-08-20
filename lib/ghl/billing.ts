// lib/ghl/billing.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { getGhlAccessToken, ghlHeaders } from "@/lib/ghl/client";

const GHL_BASE_URL = process.env.GHL_API_BASE_URL!;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * companyId is a required field on every Wallet Charge, but wasn't captured
 * for orgs that connected before app/api/auth/oauth/callback/route.ts
 * started reading it out of the token exchange response. Lazily backfill it
 * from GET /locations/{orgId} (which also returns it) the first time it's
 * needed, and persist it so this only ever runs once per org.
 */
export async function getOrgCompanyId(orgId: string): Promise<string> {
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { companyId: true } });
  if (org?.companyId) return org.companyId;

  const accessToken = await getGhlAccessToken(orgId);
  const res = await fetch(`${GHL_BASE_URL}/locations/${orgId}`, {
    headers: ghlHeaders(accessToken),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  const companyId = json?.location?.companyId ? String(json.location.companyId) : null;

  if (!res.ok || !companyId) {
    throw new Error(
      `Could not resolve companyId for org ${orgId} (${res.status}): ${JSON.stringify(json)}`
    );
  }

  await prisma.org.update({ where: { id: orgId }, data: { companyId } });
  return companyId;
}

export type ChargeStorageOverageArgs = {
  orgId: string;
  /** GB, may be fractional -- billed at `price`, or the meter's default if omitted. */
  units: number;
  description: string;
  /** Caller-supplied, unique per charge -- your own reference for this event, not a GHL idempotency key. */
  eventId: string;
  /**
   * Per-GB override within the meter's configured $0.09-$0.12 dynamic-price
   * range (e.g. the Pro-plan discount -- see lib/storageLimit.ts's
   * overageRatePerGbForPlan). Omit to charge the meter's default ($0.12).
   */
  price?: number;
};

/**
 * Fires a HighLevel Wallet Charge against the "Storage Overage" billing
 * meter (Custom Event (API), Dynamic pricing $0.09-$0.12/GB, default
 * $0.12/GB, configured in the Marketplace developer portal). Requires the
 * `charges.write` OAuth scope -- see GHL_SCOPES in .env and the app's scope
 * config in the developer portal.
 *
 * API reference: POST /marketplace/billing/charges (RaiseChargeBodyDTO),
 * verified against GoHighLevel/highlevel-api-docs' apps/marketplace.json.
 */
export async function chargeStorageOverage({
  orgId,
  units,
  description,
  eventId,
  price,
}: ChargeStorageOverageArgs): Promise<{ chargeId: string }> {
  const appId = mustEnv("GHL_APP_ID");
  const meterId = mustEnv("GHL_STORAGE_OVERAGE_METER_ID");

  const [accessToken, companyId] = await Promise.all([
    getGhlAccessToken(orgId),
    getOrgCompanyId(orgId),
  ]);

  const res = await fetch(`${GHL_BASE_URL}/marketplace/billing/charges`, {
    method: "POST",
    headers: ghlHeaders(accessToken),
    body: JSON.stringify({
      appId,
      meterId,
      eventId,
      locationId: orgId,
      companyId,
      description,
      units,
      // Omitted when undefined -- GHL applies the meter's default per-unit
      // price ($0.12/GB) whenever `price` isn't sent.
      ...(price != null ? { price } : {}),
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success !== true) {
    throw new Error(
      `Wallet charge failed for org ${orgId} (${res.status}): ${JSON.stringify(json)}`
    );
  }

  return { chargeId: String(json.chargeId) };
}
