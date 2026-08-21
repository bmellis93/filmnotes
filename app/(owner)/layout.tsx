import { redirect } from "next/navigation";
import OwnerShell from "@/components/owner/OwnerShell";
import { OwnerRoleProvider } from "@/components/owner/OwnerRoleContext";
import { requireOwnerContext, hasRole } from "@/lib/auth/ownerSession";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOwnerContext();
  if (!hasRole(ctx, "VIEWER")) redirect("/login?error=no_access");
  return (
    <OwnerRoleProvider role={ctx.role}>
      <OwnerShell>{children}</OwnerShell>
    </OwnerRoleProvider>
  );
}