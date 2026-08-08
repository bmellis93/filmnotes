"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cloud, HardDrive, ArrowLeft } from "lucide-react";

type Breakdown = {
  ok: boolean;
  limitBytes: string;
  usedBytes: string;
  activeBytes: string;
  archivedBytes: string;
  counterUsedBytes: string;
  topGalleries: {
    galleryId: string;
    galleryName: string;
    videoCount: number;
    bytes: string;
    activeBytes: string;
    archivedBytes: string;
  }[];
  largestVideos: {
    id: string;
    title: string | null;
    sizeBytes: number;
    archivedAt: string | null;
    createdAt: string;
    galleryId: string | null;
    galleryName: string | null;
  }[];
};

function toNum(x: string) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmtGB(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 10 ? gb.toFixed(0) : gb.toFixed(1);
}

export default function StorageBreakdownScreen() {
  const [data, setData] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError(null);
      const res = await fetch("/api/owner/storage/breakdown", { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        if (!cancelled) setError(t || "Failed to load breakdown");
        return;
      }
      const json = (await res.json()) as Breakdown;
      if (!cancelled) setData(json);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const computed = useMemo(() => {
    if (!data?.ok) return null;

    const limit = toNum(data.limitBytes);
    const used = toNum(data.usedBytes);
    const active = toNum(data.activeBytes);
    const archived = toNum(data.archivedBytes);
    const counter = toNum(data.counterUsedBytes);

    const pct = limit > 0 ? Math.max(0, Math.min(1, used / limit)) : 0;
    const warn = pct >= 0.9;

    const drift = Math.abs(counter - used);
    const driftPct = used > 0 ? drift / used : 0;

    return { limit, used, active, archived, counter, pct, warn, drift, driftPct };
  }, [data]);

  // ✅ derive thresholds from computed (safe)
  const nearLimit = (computed?.pct ?? 0) >= 0.8;
  const critical = (computed?.pct ?? 0) >= 0.95;

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-[var(--surface-0)] text-[var(--text-1)]">
        <div className="mx-auto w-full max-w-6xl p-5">
          <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4 text-sm">
            <div className="font-semibold">Storage</div>
            <div className="mt-2 text-[var(--text-3)]">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !computed) {
    return (
      <div className="min-h-[100dvh] bg-[var(--surface-0)] text-[var(--text-1)]">
        <div className="mx-auto w-full max-w-6xl p-5">
          <div className="flex items-center gap-2 text-sm text-[var(--text-3)]">
            <Cloud className="h-4 w-4" /> Loading storage…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--surface-0)] text-[var(--text-1)]">
      <div className="mx-auto w-full max-w-6xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/owner/galleries"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>

            <div>
              <div className="text-lg font-semibold">Storage</div>
              <div className="text-sm text-[var(--text-muted)]">
                Archived videos still count toward storage.
              </div>
            </div>
          </div>
        </div>

        {/* Top bar */}
        <div className="mt-5 rounded-3xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-[var(--text-2)]" />
              <div className="text-sm font-semibold">Usage</div>
            </div>

            <div className={computed.warn ? "text-red-600 dark:text-red-300 text-sm" : "text-[var(--text-3)] text-sm"}>
              {fmtGB(computed.used)} / {fmtGB(computed.limit)} GB
            </div>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full bg-[var(--accent-solid)]/80"
              style={{ width: `${Math.round(computed.pct * 100)}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/30 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Active</div>
              <div className="mt-1 text-sm font-semibold">{fmtGB(computed.active)} GB</div>
            </div>

            <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/30 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Archived</div>
              <div className="mt-1 text-sm font-semibold">{fmtGB(computed.archived)} GB</div>
            </div>

            <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/30 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Counter drift
              </div>
              <div className="mt-1 text-sm font-semibold">
                {computed.drift < 1_000_000 ? "OK" : `${fmtGB(computed.drift)} GB`}
              </div>
              {computed.driftPct > 0.02 ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-xs text-[var(--text-muted)]">Counter drift detected.</div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Reconcile storage counters now?")) return;

                      const res = await fetch("/api/owner/storage/reconcile", { method: "POST" });
                      if (!res.ok) {
                        const t = await res.text().catch(() => "");
                        alert(t || "Reconcile failed");
                        return;
                      }

                      // simplest: reload breakdown
                      window.location.reload();
                    }}
                    className="inline-flex rounded-lg bg-[var(--accent-solid)]/10 px-2 py-1 text-[11px] text-[var(--text-1)] hover:bg-[var(--accent-solid)]/15"
                  >
                    Run reconcile
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3">
            <Link
              href="/owner/galleries"
              className="text-xs text-[var(--text-3)] underline decoration-neutral-700 hover:text-[var(--text-1)]"
            >
              Go manage galleries →
            </Link>
          </div>
        </div>

        {/* Top galleries */}
        <div className="mt-6 rounded-3xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
          <div className="text-sm font-semibold">Top galleries by storage</div>
          <div className="mt-3 space-y-2">
            {data.topGalleries.length === 0 ? (
              <div className="text-sm text-[var(--text-muted)]">No videos yet.</div>
            ) : (
              data.topGalleries.map((g) => {
                const bytes = toNum(g.bytes);
                return (
                  <Link
                    key={g.galleryId}
                    href={`/owner/galleries/${g.galleryId}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/20 px-3 py-2 hover:bg-[var(--surface-1)]/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-[var(--text-1)]">{g.galleryName}</div>
                      <div className="text-xs text-neutral-500">{g.videoCount} videos</div>
                    </div>
                    <div className="shrink-0 text-sm text-[var(--text-2)]">
                      {fmtGB(bytes)} GB
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {nearLimit && (
          <div
            className={[
              "mt-4 rounded-2xl border px-4 py-3 text-sm",
              critical
                ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200"
                : "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200",
            ].join(" ")}
          >
            <div className="font-semibold">
              {critical ? "Storage almost full" : "Storage getting tight"}
            </div>

            <div className="mt-1 text-xs opacity-90">
              Archived videos still count toward storage. Deleting old or unused videos
              will immediately free space.
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="/owner/galleries?archived=1"
                className="inline-flex rounded-lg bg-[var(--accent-solid)]/10 px-3 py-1.5 text-xs text-[var(--text-1)] hover:bg-[var(--accent-solid)]/15"
              >
                Review archived videos
              </a>

              <a
                href="/owner/galleries"
                className="inline-flex rounded-lg border border-[var(--accent-solid)]/20 px-3 py-1.5 text-xs text-[var(--text-1)] hover:bg-[var(--accent-solid)]/10"
              >
                Manage galleries
              </a>
            </div>
          </div>
        )}
        
        {/* Largest videos */}
        <div className="mt-6 rounded-3xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
          <div className="text-sm font-semibold">Largest videos</div>

          <div className="mt-3 space-y-2">
            {data.largestVideos.length === 0 ? (
              <div className="text-sm text-[var(--text-muted)]">No videos yet.</div>
            ) : (
              data.largestVideos.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm text-[var(--text-1)]">{v.title}</div>
                      {v.archivedAt ? (
                        <span className="rounded-full border border-[var(--border-3)] bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-[var(--text-2)]">
                          Archived
                        </span>
                      ) : null}
                    </div>

                    {v.galleryId ? (
                      <Link
                        href={`/owner/galleries/${v.galleryId}`}
                        className="text-xs text-neutral-500 underline decoration-neutral-800 hover:text-[var(--text-3)]"
                      >
                        {v.galleryName ?? "View gallery"}
                      </Link>
                    ) : (
                      <div className="text-xs text-neutral-500">No gallery</div>
                    )}
                  </div>

                  <div className="shrink-0 text-sm text-[var(--text-2)]">
                    {fmtGB(v.sizeBytes)} GB
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}