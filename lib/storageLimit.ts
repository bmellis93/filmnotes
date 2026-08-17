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

export function clampNonNegativeBigInt(x: bigint) {
  return x < BigInt(0) ? BigInt(0) : x;
}
