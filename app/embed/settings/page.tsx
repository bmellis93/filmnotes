"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SettingsScreen from "@/components/owner/SettingsScreen";
import { useEmbedSession } from "@/components/embed/useEmbedSession";
import { EmbedShell } from "@/components/embed/EmbedShell";

export default function EmbedSettingsPage() {
  const router = useRouter();
  const { ready, role, orgId } = useEmbedSession();

  // Mirrors the standalone app's page-level ADMIN guard
  // (app/(owner)/owner/settings/page.tsx) -- the underlying API routes
  // already 403 for non-admins, but a non-admin shouldn't see the page
  // shell at all.
  useEffect(() => {
    if (ready && role && role !== "ADMIN") {
      router.replace("/embed/galleries");
    }
  }, [ready, role, router]);

  if (!ready || !role || !orgId) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-2)]">
        <div className="text-sm">Loading…</div>
      </div>
    );
  }

  if (role !== "ADMIN") {
    return null;
  }

  return (
    <EmbedShell role={role}>
      <SettingsScreen orgId={orgId} />
    </EmbedShell>
  );
}
