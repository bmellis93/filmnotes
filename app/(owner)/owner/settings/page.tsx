// app/owner/settings/page.tsx
import { redirect } from "next/navigation";
import { requireOwnerContext, hasRole } from "@/lib/auth/ownerSession";
import SettingsScreen from "@/components/owner/SettingsScreen";

export default async function OwnerSettingsPage() {
  const owner = await requireOwnerContext(); // protects route
  if (!hasRole(owner, "ADMIN")) redirect("/owner/galleries");
  return <SettingsScreen orgId={owner.orgId} />;
}