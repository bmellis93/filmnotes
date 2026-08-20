// lib/storageLimit.ts
import type { OrgPlan } from "@prisma/client";

const GiB = BigInt(1024) * BigInt(1024) * BigInt(1024);

// Default storageLimitBytes seeded onto an Org when it's created or moved
// onto a plan. storageLimitBytes on the Org row is the actual enforced
// value everywhere else in the app -- these are just the starting points
// (CUSTOM deals and promos can and do diverge from their plan's default).
export const PLAN_STORAGE_DEFAULTS: Record<OrgPlan, bigint> = {
  STARTER: BigInt(100) * GiB, // 100 GB -- $19/mo
  STUDIO: BigInt(500) * GiB, // 500 GB -- $59/mo
  PRO: BigInt(1000) * GiB, // 1 TB -- $129/mo
  CUSTOM: BigInt(1000) * GiB, // negotiated per deal; fallback only
  OWNER: BigInt(10) * BigInt(1024) * GiB, // 10 TiB -- the app developer's own account, never billed
};

export function defaultStorageLimitForPlan(plan: OrgPlan): bigint {
  return PLAN_STORAGE_DEFAULTS[plan];
}

// Per-GB storage overage rate for plans that get a discount off the "Storage
// Overage" billing meter's default price ($0.12/GB, configured in the GHL
// dev portal as a Dynamic-pricing meter with a $0.09-$0.12 range). Plans not
// listed here fall back to the meter's own default -- see
// lib/ghl/billing.ts's chargeStorageOverage, which only sends an explicit
// `price` override when this returns a value.
const OVERAGE_RATE_PER_GB_BY_PLAN: Partial<Record<OrgPlan, number>> = {
  PRO: 0.09,
};

export function overageRatePerGbForPlan(plan: OrgPlan): number | undefined {
  return OVERAGE_RATE_PER_GB_BY_PLAN[plan];
}

export function clampNonNegativeBigInt(x: bigint) {
  return x < BigInt(0) ? BigInt(0) : x;
}
