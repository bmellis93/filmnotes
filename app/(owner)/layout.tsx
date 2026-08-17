import OwnerShell from "@/components/owner/OwnerShell";
import { OwnerRoleProvider } from "@/components/owner/OwnerRoleContext";
import { requireOwnerContext } from "@/lib/auth/ownerSession";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOwnerContext();
  return (
    <OwnerRoleProvider role={ctx.role}>
      <OwnerShell>{children}</OwnerShell>
    </OwnerRoleProvider>
  );
}