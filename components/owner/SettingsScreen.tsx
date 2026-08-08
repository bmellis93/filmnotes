"use client";

import ThemeToggle from "@/components/ThemeToggle"; // or wherever you put it
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";

type Props = { orgId: string };

export default function SettingsScreen({ orgId }: Props) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [team, setTeam] = useState<any[]>([]);

  async function loadTeam() {
    try {
      const res = await fetch("/api/owner/team", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load team");
      setTeam(json.team ?? []);
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Failed to load team" });
    } finally {
      setLoadingTeam(false);
    }
  }

  useEffect(() => {
    void loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function syncFromGhl() {
    setSyncing(true);
    try {
      const res = await fetch("/api/owner/team/sync", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.detail || json?.error || "Sync failed");
      }
      await loadTeam();
      toast({
        kind: "success",
        message: `Synced ${json.synced} team member${json.synced === 1 ? "" : "s"} from GHL`,
      });
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold text-[var(--text-1)]">Settings</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Org: {orgId}</p>

      <div className="mt-6 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
        <div className="text-sm font-semibold text-[var(--text-1)]">Appearance</div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-[var(--text-3)]">Theme</div>
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text-1)]">Team & Permissions</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Pulled from GoHighLevel team members.
            </div>
          </div>

          <button
            type="button"
            onClick={syncFromGhl}
            disabled={syncing}
            className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-2)] disabled:opacity-60"
          >
            {syncing ? "Syncing…" : "Sync from GHL"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loadingTeam ? (
            <div className="text-sm text-[var(--text-muted)]">Loading…</div>
          ) : team.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">
              No team members yet. Click "Sync from GHL" to pull your team.
            </div>
          ) : (
            team.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-[var(--text-1)]">{m.name ?? m.email ?? m.ghlUserId}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">{m.email ?? "—"}</div>
                </div>
                <div className="shrink-0 text-xs font-semibold text-[var(--text-2)]">
                  {m.role ?? "MEMBER"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}