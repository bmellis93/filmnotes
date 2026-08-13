"use client";

import { useEffect, useState } from "react";

// Landing page for the OAuth popup opened from inside the embedded Custom
// Page (GHL's own authorize screen can't be framed, so /connect opens this
// in a new tab). Tells the iframe it can re-check the connection, then gets
// out of the way.
export default function GhlEmbedConnectedPage() {
  const [canAutoClose, setCanAutoClose] = useState(false);

  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ message: "GHL_EMBED_CONNECTED" }, "*");
      setCanAutoClose(true);
      const t = setTimeout(() => window.close(), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)] p-6">
      <div className="text-center">
        <div className="text-lg font-semibold">Connected</div>
        <div className="mt-1 text-sm text-[var(--text-muted)]">
          {canAutoClose
            ? "This tab will close automatically."
            : "You can close this tab and go back to HighLevel."}
        </div>
      </div>
    </div>
  );
}
