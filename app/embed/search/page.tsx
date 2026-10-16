"use client";

import { Suspense } from "react";
import SearchScreen from "@/components/owner/SearchScreen";
import { useEmbedSession } from "@/components/embed/useEmbedSession";
import { EmbedShell } from "@/components/embed/EmbedShell";

export default function EmbedSearchPage() {
  const { ready, role } = useEmbedSession();

  if (!ready) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-2)]">
        <div className="text-sm">Loading…</div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)] p-6">
        <div className="text-sm text-[var(--text-2)]">Couldn&apos;t load your permissions.</div>
      </div>
    );
  }

  return (
    <EmbedShell role={role}>
      {/* SearchScreen reads ?q= via useSearchParams, which needs a Suspense boundary. */}
      <Suspense>
        <SearchScreen basePath="/embed/galleries" />
      </Suspense>
    </EmbedShell>
  );
}
