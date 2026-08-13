// lib/embed/fetchAuth.ts
"use client";

/**
 * Patches window.fetch so every existing dashboard component (OwnerGalleriesClient,
 * GalleryDetailScreen, VideoReviewScreen, CommentsPanel's hooks, useVideoPlayer, etc.)
 * keeps working completely unmodified inside the GHL embed -- none of them need to know
 * they're not running standalone. It only touches same-origin `/api/...` requests that
 * don't already carry an Authorization header, so it's a no-op for anything unrelated.
 *
 * Why this exists at all: Custom Pages render in a cross-site iframe, where the owner-
 * session cookie (SameSite=Lax) never reaches your domain -- browsers don't send it on
 * framed subresource requests. The embed holds a short-lived bearer token instead (see
 * app/api/ghl/sso/route.ts) and this is how it gets attached to calls those components
 * already make via plain `fetch("/api/...")`.
 */

let originalFetch: typeof window.fetch | null = null;

function isSameOriginApiRequest(input: RequestInfo | URL): boolean {
  try {
    const url =
      typeof input === "string" || input instanceof URL
        ? new URL(input, window.location.origin)
        : new URL(input.url, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export function installEmbedFetchAuth(token: string): () => void {
  if (typeof window === "undefined") return () => {};

  const baseFetch = originalFetch ?? window.fetch.bind(window);
  originalFetch = baseFetch;

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (!isSameOriginApiRequest(input)) return baseFetch(input, init);

    const existing = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    const nextHeaders = new Headers(existing);
    if (!nextHeaders.has("Authorization")) {
      nextHeaders.set("Authorization", `Bearer ${token}`);
    }

    if (input instanceof Request) {
      return baseFetch(new Request(input, { headers: nextHeaders }));
    }
    return baseFetch(input, { ...init, headers: nextHeaders });
  }) as typeof window.fetch;

  return () => {
    window.fetch = baseFetch;
  };
}
