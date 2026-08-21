// lib/auth/roles.ts
// Client-safe: no "server-only" import here, so client components (nav,
// buttons) can gate on role without pulling in cookies()/jwtVerify().
import type { OrgRole } from "@prisma/client";

export type { OrgRole };

export const ROLE_RANK: Record<OrgRole, number> = {
  NONE: 0,
  VIEWER: 1,
  UPLOADER: 2,
  CONTRIBUTOR: 3,
  ADMIN: 4,
};

export function hasRole(role: OrgRole, min: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
