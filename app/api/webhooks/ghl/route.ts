// app/api/webhooks/ghl/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyGhlWebhookSignature } from "@/lib/ghl/webhookVerify";
import { mapGhlPlanIdToOrgPlan } from "@/lib/ghl/planMapping";
import { defaultStorageLimitForPlan } from "@/lib/storageLimit";

export const runtime = "nodejs";

/**
 * Applies a GHL marketplace planId (from INSTALL or PLAN_CHANGE) to an org's
 * plan + storageLimitBytes. Skips silently -- never touches the row -- when
 * the planId doesn't map to a known plan (e.g. our free internal app
 * version, which has no pricing configured) or when the org is on OWNER,
 * which is never meant to be driven by GHL's own billing.
 */
async function applyPlanToOrg(locationId: string, planId: string | null | undefined) {
  const mappedPlan = mapGhlPlanIdToOrgPlan(planId);
  if (!mappedPlan) return;

  const existing = await prisma.org.findUnique({
    where: { id: locationId },
    select: { plan: true },
  });

  if (existing?.plan === "OWNER") return;

  const storageLimitBytes = defaultStorageLimitForPlan(mappedPlan);

  await prisma.org.upsert({
    where: { id: locationId },
    create: {
      id: locationId,
      plan: mappedPlan,
      storageLimitBytes,
      ghlPlanId: planId,
    },
    update: {
      plan: mappedPlan,
      storageLimitBytes,
      ghlPlanId: planId,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    verifyGhlWebhookSignature(rawBody, req.headers.get("x-ghl-signature"));

    const evt = JSON.parse(rawBody) as {
      type?: string;
      locationId?: string;
      planId?: string;
      newPlanId?: string;
    };

    const locationId = evt.locationId;
    if (!locationId) {
      return NextResponse.json({ ok: true, ignored: "Missing locationId" });
    }

    switch (evt.type) {
      case "INSTALL":
        await applyPlanToOrg(locationId, evt.planId);
        break;
      case "PLAN_CHANGE":
        await applyPlanToOrg(locationId, evt.newPlanId);
        break;
      default:
        // UNINSTALL, AppPaymentStatus, AppUpdate, etc. -- not handled yet.
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("GHL webhook error:", err);
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
