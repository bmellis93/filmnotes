"use client";

import { useEffect, useState } from "react";
import OwnerGalleriesClient, {
  type OwnerGalleryListItem,
} from "@/components/owner/OwnerGalleriesClient";
import { useEmbedSession } from "@/components/embed/useEmbedSession";
import { EmbedShell } from "@/components/embed/EmbedShell";

export default function EmbedGalleriesPage() {
  const { ready, role } = useEmbedSession();
  const [galleries, setGalleries] = useState<OwnerGalleryListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    fetch("/api/owner/galleries")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load galleries (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setGalleries(data.galleries);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to load galleries");
      });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready || (!galleries && !error)) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-2)]">
        <div className="text-sm">Loading…</div>
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)] p-6">
        <div className="text-sm text-[var(--text-2)]">{error ?? "Couldn't load your permissions."}</div>
      </div>
    );
  }

  return (
    <EmbedShell role={role}>
      <OwnerGalleriesClient
        initialGalleries={galleries!}
        basePath="/embed/galleries"
        storagePath="/embed/storage"
      />
    </EmbedShell>
  );
}
