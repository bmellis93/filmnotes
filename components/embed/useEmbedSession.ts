"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { installEmbedFetchAuth } from "@/lib/embed/fetchAuth";
import { EMBED_TOKEN_STORAGE_KEY } from "@/lib/embed/constants";

/**
 * Every embed page under app/embed/** (other than the handshake root
 * itself) calls this first. It reads the token the root page stored after
 * the SSO handshake, installs the fetch interceptor so the page's own data
 * fetch (and every fetch made by whatever dashboard component it renders)
 * carries it, and bounces back to the handshake page if there's no token --
 * e.g. a hard refresh landed directly on a deep link inside the iframe.
 */
export function useEmbedSession(): { ready: boolean } {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem(EMBED_TOKEN_STORAGE_KEY);
    if (!token) {
      router.replace("/embed");
      return;
    }

    const restore = installEmbedFetchAuth(token);
    setReady(true);
    return restore;
  }, [router]);

  return { ready };
}
