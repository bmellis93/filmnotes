import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chargeStorageOverage } from "@/lib/ghl/billing";
import { overageRatePerGbForPlan } from "@/lib/storageLimit";

export const runtime = "nodejs";

const GiB = BigInt(1024) * BigInt(1024) * BigInt(1024);
const MIN_BILLABLE_BYTES = GiB; // don't fire a charge for < 1 GB of new overage

// Sanity ceiling: never bill more than this many GB for one org in a single
// run, even if the math says more. Guards against a bug (bad migration,
// corrupted counter) causing a runaway charge -- a real customer would need
// to be ~5x over the largest plan (1 TB) to hit this legitimately, which
// isn't a real scenario. It's a circuit breaker, not a plan limit.
const MAX_BILLABLE_UNITS_PER_RUN = 5000; // GB

function isNewBillingPeriod(periodStart: Date | null, now: Date): boolean {
  if (!periodStart) return true;
  return (
    periodStart.getUTCFullYear() !== now.getUTCFullYear() ||
    periodStart.getUTCMonth() !== now.getUTCMonth()
  );
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";
  const now = new Date();

  // OWNER plan is never billed, and PRIVATE-edition orgs (installed via the
  // free/private GHL app, which has no pricing configured) are never billed
  // either -- only PAID-edition orgs (the public Marketplace app) are
  // candidates. Filtering "actually over their limit" happens in JS below
  // since Prisma can't compare two columns of the same row in a `where`
  // clause, and the org count here is nowhere near large enough to need a
  // raw query for it.
  const orgs = await prisma.org.findMany({
    where: { plan: { not: "OWNER" }, appEdition: "PAID" },
    select: {
      id: true,
      plan: true,
      storageUsedBytes: true,
      storageLimitBytes: true,
      overageBilledBytes: true,
      overageBillingPeriodStart: true,
    },
  });

  let billed = 0;
  let skipped = 0;
  let failed = 0;
  const results: Array<{
    orgId: string;
    unitsBilled?: number;
    pricePerGb?: number;
    chargeId?: string;
    error?: string;
  }> = [];

  for (const org of orgs) {
    try {
      const used = BigInt(org.storageUsedBytes);
      const limit = BigInt(org.storageLimitBytes);
      const currentOverage = used > limit ? used - limit : BigInt(0);

      if (currentOverage === BigInt(0)) {
        skipped++;
        continue;
      }

      const periodReset = isNewBillingPeriod(org.overageBillingPeriodStart, now);
      const alreadyBilled = periodReset ? BigInt(0) : BigInt(org.overageBilledBytes);
      const newBillableBytes =
        currentOverage > alreadyBilled ? currentOverage - alreadyBilled : BigInt(0);

      if (newBillableBytes < MIN_BILLABLE_BYTES) {
        skipped++;
        continue;
      }

      let unitsGB = Math.round((Number(newBillableBytes) / Number(GiB)) * 100) / 100;

      if (unitsGB > MAX_BILLABLE_UNITS_PER_RUN) {
        console.error(
          `Storage overage sanity cap hit for org ${org.id}: computed ${unitsGB}GB, capping at ${MAX_BILLABLE_UNITS_PER_RUN}GB -- investigate before this org's next run.`
        );
        unitsGB = MAX_BILLABLE_UNITS_PER_RUN;
      }

      if (dryRun) {
        results.push({ orgId: org.id, unitsBilled: unitsGB, pricePerGb: overageRatePerGbForPlan(org.plan) ?? 0.12 });
        billed++;
        continue;
      }

      const periodStart = periodReset ? now : org.overageBillingPeriodStart ?? now;
      const newOverageBilledBytes = alreadyBilled + BigInt(Math.round(unitsGB * Number(GiB)));
      const eventId = `storage-overage:${org.id}:${now.toISOString().slice(0, 7)}:${now.getTime()}`;

      const { chargeId } = await chargeStorageOverage({
        orgId: org.id,
        units: unitsGB,
        description: `Storage overage: ${unitsGB} GB`,
        eventId,
        price: overageRatePerGbForPlan(org.plan),
      });

      // Only claim the billed bytes if the row hasn't moved under us since
      // we read it (mirrors the atomic storage-reserve pattern used for
      // uploads) -- avoids double-billing if this ever runs concurrently.
      const claim = await prisma.org.updateMany({
        where: { id: org.id, overageBilledBytes: org.overageBilledBytes },
        data: { overageBilledBytes: newOverageBilledBytes, overageBillingPeriodStart: periodStart },
      });

      if (claim.count !== 1) {
        // The charge already went out to GHL, but we lost the race to
        // record it locally -- log loudly so this gets reconciled by hand
        // instead of silently double-billing on the next run.
        console.error(
          `Storage overage charge ${chargeId} succeeded for org ${org.id} but the local counter update lost a race -- reconcile overageBilledBytes manually.`
        );
      }

      results.push({ orgId: org.id, unitsBilled: unitsGB, pricePerGb: overageRatePerGbForPlan(org.plan) ?? 0.12, chargeId });
      billed++;
    } catch (err: any) {
      console.error("Storage overage billing failed for org", org.id, err);
      failed++;
      results.push({ orgId: org.id, error: err?.message ?? String(err) });
    }
  }

  return NextResponse.json({ ok: true, dryRun, billed, skipped, failed, results });
}
