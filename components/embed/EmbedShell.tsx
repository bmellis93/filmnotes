"use client";

import type { ReactNode } from "react";
import OwnerShell from "@/components/owner/OwnerShell";
import { OwnerRoleProvider } from "@/components/owner/OwnerRoleContext";
import type { OrgRole } from "@/lib/auth/roles";

/**
 * Wraps embed page content in the same left-sidebar shell the standalone
 * app gets from app/(owner)/layout.tsx (Galleries/Search/Settings nav) --
 * every embed page under app/embed/** other than the handshake root uses
 * this once it has a resolved role from useEmbedSession().
 */
export function EmbedShell({ role, children }: { role: OrgRole; children: ReactNode }) {
  return (
    <OwnerRoleProvider role={role}>
      <OwnerShell basePath="/embed">{children}</OwnerShell>
    </OwnerRoleProvider>
  );
}
