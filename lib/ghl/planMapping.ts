// lib/ghl/planMapping.ts
import "server-only";
import type { OrgPlan } from "@prisma/client";

// GHL's marketplace plan IDs are opaque per-app values assigned when each
// pricing plan is created in the developer portal's Pricing page -- not
// something we can derive, so they're configured per-environment.
const PLAN_ID_ENV_VARS: Record<string, OrgPlan> = {
  GHL_PLAN_ID_STARTER: "STARTER",
  GHL_PLAN_ID_STUDIO: "STUDIO",
  GHL_PLAN_ID_PRO: "PRO",
};

/**
 * Maps a GHL marketplace planId (from an INSTALL or PLAN_CHANGE webhook) to
 * our own OrgPlan enum. Returns null for an unmapped or missing planId --
 * callers must treat that as "leave the org's plan untouched" rather than
 * guessing, since silently defaulting could downgrade a paying customer or
 * clobber a CUSTOM/OWNER plan that was never meant to come from GHL at all.
 */
export function mapGhlPlanIdToOrgPlan(planId: string | null | undefined): OrgPlan | null {
  if (!planId) return null;

  for (const [envVar, plan] of Object.entries(PLAN_ID_ENV_VARS)) {
    if (process.env[envVar] && process.env[envVar] === planId) {
      return plan;
    }
  }

  return null;
}
