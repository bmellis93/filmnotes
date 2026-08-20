// app/owner/settings/page.tsx
import { redirect } from "next/navigation";
import { requireOwnerContext, hasRole } from "@/lib/auth/ownerSession";
import { prisma } from "@/lib/prisma";
import SettingsScreen from "@/components/owner/SettingsScreen";

export default async function OwnerSettingsPage() {
  const owner = await requireOwnerContext(); // protects route
  if (!hasRole(owner, "ADMIN")) redirect("/owner/galleries");

  // Only the GHL Marketplace reviewer demo org gets the "connect your own
  // sandbox" section -- see app/api/auth/reviewer-connect/start/route.ts.
  const isReviewerOrg = owner.orgId === process.env.REVIEWER_ORG_ID;
  const hasGhlConnection =
    isReviewerOrg &&
    (await prisma.installation.findUnique({ where: { orgId: owner.orgId }, select: { orgId: true } })) != null;

  return <SettingsScreen orgId={owner.orgId} isReviewerOrg={isReviewerOrg} hasGhlConnection={hasGhlConnection} />;
}