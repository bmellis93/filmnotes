"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { installEmbedFetchAuth } from "@/lib/embed/fetchAuth";
import {
  EMBED_TOKEN_STORAGE_KEY,
  EMBED_TOKEN_EXPIRES_AT_STORAGE_KEY,
  EMBED_TOKEN_TTL_SECONDS,
} from "@/lib/embed/constants";
import { fetchEmbedSsoResponse } from "@/lib/embed/ghlHandshake";
import type { OrgRole } from "@/lib/auth/roles";

// 80% of whatever time is actually left until `expiresAt`, not 80% of the
// full TTL -- every embed page mounts this hook independently (no shared
// layout under app/embed), so a fixed offset from mount time resets on every
// navigation and can leave a gap where the token expires before the next
// scheduled refresh fires. Scheduling off the real remaining time instead
// means a refresh always lands strictly before expiry, no matter when in
// the token's lifetime this hook happens to (re)mount.
function msUntilRefresh(expiresAt: number): number {
  const remaining = expiresAt - Date.now();
  return remaining > 0 ? remaining * 0.8 : 0;
}

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
export function useEmbedSession(): { ready: boolean; role: OrgRole | null; orgId: string | null } {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<OrgRole | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem(EMBED_TOKEN_STORAGE_KEY);
    if (!token) {
      router.replace("/embed");
      return;
    }

    // Older/missing storage (shouldn't happen post-handshake, but stay safe)
    // falls back to assuming a fresh full TTL rather than refreshing instantly.
    const storedExpiresAt = Number(sessionStorage.getItem(EMBED_TOKEN_EXPIRES_AT_STORAGE_KEY));
    const expiresAt = Number.isFinite(storedExpiresAt) && storedExpiresAt > 0
      ? storedExpiresAt
      : Date.now() + EMBED_TOKEN_TTL_SECONDS * 1000;

    let restore = installEmbedFetchAuth(token);
    let cancelled = false;
    let refreshTimer: number | undefined;

    // The embed token is short-lived (EMBED_TOKEN_TTL_SECONDS) so a tab left
    // open past that would otherwise start failing every API call with no
    // way to recover short of a manual reload -- mirrors the same
    // refresh-before-expiry pattern useVideoPlayer already uses for Mux
    // playback tokens. GHL keeps the parent window's postMessage handshake
    // available for as long as the Custom Page iframe is mounted, so this
    // can silently re-run it and swap in a new token with no user action.
    async function refreshToken() {
      try {
        const data = await fetchEmbedSsoResponse();
        if (cancelled) return;
        if (data.connected) {
          sessionStorage.setItem(EMBED_TOKEN_STORAGE_KEY, data.embedToken);
          sessionStorage.setItem(EMBED_TOKEN_EXPIRES_AT_STORAGE_KEY, String(data.expiresAt));
          restore();
          restore = installEmbedFetchAuth(data.embedToken);
          refreshTimer = window.setTimeout(refreshToken, msUntilRefresh(data.expiresAt));
          return;
        }
        // Not connected any more (e.g. uninstalled mid-session) -- next API
        // call will 401 and the page's own error handling takes over;
        // nothing productive to retry here.
      } catch (err) {
        console.error("Failed to refresh embed session token:", err);
        // Retry sooner rather than leaving the session stuck until it
        // actually expires.
        if (!cancelled) refreshTimer = window.setTimeout(refreshToken, 60_000);
      }
    }
    refreshTimer = window.setTimeout(refreshToken, msUntilRefresh(expiresAt));

    (async () => {
      try {
        const res = await fetch("/api/owner/me", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.role) {
          setRole(data.role);
          if (typeof data.orgId === "string") setOrgId(data.orgId);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      restore();
    };
  }, [router]);

  return { ready, role, orgId };
}
