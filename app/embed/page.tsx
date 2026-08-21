"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EMBED_TOKEN_STORAGE_KEY } from "@/lib/embed/constants";

type SsoResponse =
  | { connected: true; embedToken: string; orgId: string }
  | { connected: false; reason: "not-installed"; connectUrl: string }
  | { connected: false; reason: "no-location" }
  | { connected: false; reason: "no-access" };

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-connected"; connectUrl: string };

// Request the encrypted SSO payload from the GHL parent window. See
// https://marketplace.gohighlevel.com/docs/other/user-context-marketplace-apps
// -- this is GHL's documented Custom Page handshake, not something we invented.
function requestGhlUserData(timeoutMs = 4000): Promise<string> {
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

export default function GhlEmbedPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>({ status: "loading" });

  const checkConnection = useCallback(async () => {
    setView({ status: "loading" });

    try {
      const encryptedPayload = await requestGhlUserData();

      const res = await fetch("/api/ghl/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: encryptedPayload }),
      });
      const data: SsoResponse = await res.json();

      if (data.connected) {
        sessionStorage.setItem(EMBED_TOKEN_STORAGE_KEY, data.embedToken);
        router.replace("/embed/galleries");
        return;
      }

      if (data.reason === "not-installed") {
        setView({ status: "not-connected", connectUrl: data.connectUrl });
        return;
      }

      if (data.reason === "no-access") {
        setView({
          status: "error",
          message: "Your role on this account doesn't include dashboard access.",
        });
        return;
      }

      setView({
        status: "error",
        message: "This page needs to be opened from a HighLevel location, not the agency view.",
      });
    } catch {
      setView({
        status: "error",
        message:
          "Couldn't reach HighLevel. Make sure this page is opened from inside your HighLevel account (it won't load standalone).",
      });
    }
  }, [router]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // The OAuth popup (see /embed/connected) posts back here once the
  // location has finished authorizing, so we don't make the user manually
  // refresh the iframe.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.message === "GHL_EMBED_CONNECTED") checkConnection();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [checkConnection]);

  function handleConnect(connectUrl: string) {
    // GHL's own authorize screen can't be framed, so break out to a popup
    // rather than navigating the iframe itself.
    window.open(connectUrl, "_blank", "width=520,height=680");
  }

  if (view.status === "loading") {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-2)]">
        <div className="text-sm">Loading…</div>
      </div>
    );
  }

  if (view.status === "error") {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)] p-6">
        <div className="max-w-sm text-center text-sm text-[var(--text-2)]">{view.message}</div>
      </div>
    );
  }

  // status === "not-connected"
  return (
    <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)] p-6">
      <div className="max-w-sm text-center">
        <div className="text-lg font-semibold">Connect this location</div>
        <div className="mt-1 text-sm text-[var(--text-muted)]">
          Authorize once to start reviewing videos from inside HighLevel.
        </div>
        <button
          type="button"
          onClick={() => handleConnect(view.connectUrl)}
          className="mt-4 rounded-xl bg-[var(--accent-solid)] px-4 py-2 text-sm font-semibold text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)]"
        >
          Connect HighLevel
        </button>
      </div>
    </div>
  );
}
