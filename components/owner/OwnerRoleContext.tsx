"use client";

import { createContext, useContext, type ReactNode } from "react";
import { hasRole, type OrgRole } from "@/lib/auth/roles";

const OwnerRoleContext = createContext<OrgRole | null>(null);

export function OwnerRoleProvider({ role, children }: { role: OrgRole; children: ReactNode }) {
  return <OwnerRoleContext.Provider value={role}>{children}</OwnerRoleContext.Provider>;
}

/** Current owner's role tier, and a helper to check it against a minimum. */
export function useOwnerRole() {
  const role = useContext(OwnerRoleContext);
  if (!role) throw new Error("useOwnerRole must be used within OwnerRoleProvider");
  return { role, hasRole: (min: OrgRole) => hasRole(role, min) };
}
