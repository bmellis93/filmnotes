"use client";

// Shared between app/embed/page.tsx (initial handshake) and
// useEmbedSession.ts (silent background token refresh) -- both need to
// re-request GHL's encrypted user-context payload and exchange it for an
// embed bearer token the exact same way.

export type SsoResponse =
  | { connected: true; embedToken: string; orgId: string; expiresAt: number }
  | { connected: false; reason: "not-installed"; connectUrl: string }
  | { connected: false; reason: "no-location" }
  | { connected: false; reason: "no-access" };

// Request the encrypted SSO payload from the GHL parent window. See
// https://marketplace.gohighlevel.com/docs/other/user-context-marketplace-apps
// -- this is GHL's documented Custom Page handshake, not something we invented.
export function requestGhlUserData(timeoutMs = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("timeout"));
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.data?.message !== "REQUEST_USER_DATA_RESPONSE") return;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(event.data.payload as string);
    }

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ message: "REQUEST_USER_DATA" }, "*");
  });
}

/** Re-runs the full GHL handshake and exchanges it for a fresh embed token. */
export async function fetchEmbedSsoResponse(): Promise<SsoResponse> {
  const encryptedPayload = await requestGhlUserData();

  const res = await fetch("/api/ghl/sso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: encryptedPayload }),
  });

  return res.json();
}
