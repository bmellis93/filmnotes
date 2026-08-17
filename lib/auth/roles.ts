// lib/auth/roles.ts
// Client-safe: no "server-only" import here, so client components (nav,
// buttons) can gate on role without pulling in cookies()/jwtVerify().
import type { OrgRole } from "@prisma/client";

export type { OrgRole };

export const ROLE_RANK: Record<OrgRole, number> = {
  VIEWER: 0,
  UPLOADER: 1,
  CONTRIBUTOR: 2,
  ADMIN: 3,
};

export function hasRole(role: OrgRole, min: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
