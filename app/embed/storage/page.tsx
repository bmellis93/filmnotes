"use client";

import StorageBreakdownScreen from "@/components/owner/StorageBreakdownScreen";
import { useEmbedSession } from "@/components/embed/useEmbedSession";
import { EmbedShell } from "@/components/embed/EmbedShell";

export default function EmbedStoragePage() {
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
      <StorageBreakdownScreen basePath="/embed/galleries" />
    </EmbedShell>
  );
}
