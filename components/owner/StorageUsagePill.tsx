"use client";

import { useEffect, useMemo, useState } from "react";
import { Cloud } from "lucide-react";
import Link from "next/link";

function fmtGB(bytes: bigint) {
  const gb = Number(bytes) / (1024 * 1024 * 1024);
  return gb.toFixed(gb >= 10 ? 0 : 1);
}

export default function StorageUsagePill() {
  const [used, setUsed] = useState<bigint | null>(null);
  const [limit, setLimit] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch("/api/owner/storage/usage", { cache: "no-store" });
      if (!res.ok) return;

      const data = (await res.json()) as {
        ok: boolean;
        usedBytes: string;
        limitBytes: string;
      };

      if (!cancelled && data?.ok) {
        setUsed(BigInt(data.usedBytes));
        setLimit(BigInt(data.limitBytes));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const pct = useMemo(() => {
    if (used == null || limit == null || limit === BigInt(0)) return 0;
    const p = Number(used) / Number(limit);
    return Math.max(0, Math.min(1, p));
  }, [used, limit]);

  if (used == null || limit == null) {
    return (
      <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 px-3 py-2 text-xs text-[var(--text-3)]">
        <Cloud className="h-4 w-4" />
        Storage…
      </div>
    );
  }

  const level = pct >= 0.9 ? "high" : pct >= 0.8 ? "mid" : "ok";

  const shellClass =
    level === "high"
      ? "border-orange-500/40 bg-orange-500/10"
      : level === "mid"
        ? "border-yellow-500/40 bg-yellow-500/10"
        : "border-[var(--border-1)] bg-[var(--surface-1)]/40";

  const textClass =
    level === "high"
      ? "text-orange-600 dark:text-orange-300"
      : level === "mid"
        ? "text-yellow-700 dark:text-yellow-300"
        : "";

  return (
    <Link href="/owner/storage" className="hidden sm:block">
      <div
        className={[
          "hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2",
          shellClass,
        ].join(" ")}
        title={`${fmtGB(used)}GB of ${fmtGB(limit)}GB used`}
      >
        <Cloud className="h-4 w-4 text-[var(--text-2)]" />

        <div className="min-w-[140px]">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-3)]">
            <span>Storage</span>
            <span className={textClass}>
              {fmtGB(used)} / {fmtGB(limit)} GB
            </span>
          </div>

          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full bg-[var(--accent-solid)]/80"
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}