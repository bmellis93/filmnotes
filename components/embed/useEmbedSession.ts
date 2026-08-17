"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { installEmbedFetchAuth } from "@/lib/embed/fetchAuth";
import { EMBED_TOKEN_STORAGE_KEY } from "@/lib/embed/constants";
import type { OrgRole } from "@/lib/auth/roles";

/**
 * Every embed page under app/embed/** (other than the handshake root
 * itself) calls this first. It reads the token the root page stored after
 * the SSO handshake, installs the fetch interceptor so the page's own data
 * fetch (and every fetch made by whatever dashboard component it renders)
 * carries it, and bounces back to the handshake page if there's no token --
 * e.g. a hard refresh landed directly on a deep link inside the iframe.
 *
 * Also resolves the embed user's role (the bearer token itself carries
 * none -- see app/api/ghl/sso/route.ts) so pages can wrap their rendered
 * dashboard component in OwnerRoleProvider, same as the standalone app's
 * layout does.
 */
export function useEmbedSession(): { ready: boolean; role: OrgRole | null } {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<OrgRole | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem(EMBED_TOKEN_STORAGE_KEY);
    if (!token) {
      router.replace("/embed");
      return;
    }

    const restore = installEmbedFetchAuth(token);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/owner/me", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.role) setRole(data.role);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      restore();
    };
  }, [router]);

  return { ready, role };
}
