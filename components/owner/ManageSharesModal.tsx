"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Copy, Trash2, Link2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type ShareRow = {
  id: string;
  token: string;
  kind: "gallery" | "video";
  label: string;
  view: "VIEW_ONLY" | "REVIEW_DOWNLOAD";
  allowComments: boolean;
  allowDownload: boolean;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  contactName: string | null;
  url: string;
};

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  galleryId: string;
  galleryTitle: string;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function expiryLabel(iso: string | null) {
  if (!iso) return "No expiry";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No expiry";
  const days = Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  return `Expires in ${days}d`;
}

export default function ManageSharesModal({ open, onClose, galleryId, galleryTitle }: Props) {
  const { toast } = useToast();

  const [shares, setShares] = useState<ShareRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/owner/shares?galleryId=${encodeURIComponent(galleryId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load share links");
      setShares(data.shares as ShareRow[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load share links");
    } finally {
      setLoading(false);
    }
  }, [galleryId]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  if (!open) return null;

  async function updateShare(
    id: string,
    patch: { allowComments?: boolean; allowDownload?: boolean; expiresInDays?: number | null; revoked?: boolean }
  ) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/owner/shares/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to update link");
      setShares((prev) =>
        prev
          ? prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    ...("allowComments" in patch ? { allowComments: patch.allowComments! } : {}),
                    ...("allowDownload" in patch ? { allowDownload: patch.allowDownload! } : {}),
                    expiresAt: data.share?.expiresAt ?? s.expiresAt,
                    revokedAt: data.share?.revokedAt ?? s.revokedAt,
                  }
                : s
            )
          : prev
      );
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Failed to update link" });
    } finally {
      setBusyId(null);
    }
  }

  async function deleteShare(share: ShareRow) {
    const who = share.contactName || "this recipient";
    if (!confirm(`Delete the ${share.kind === "gallery" ? "gallery" : "video"} link for ${who}? They won't be able to open it anymore.`)) {
      return;
    }

    setBusyId(share.id);
    try {
      const res = await fetch(`/api/owner/shares/${share.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to delete link");
      setShares((prev) => (prev ? prev.filter((s) => s.id !== share.id) : prev));
      toast({ kind: "success", message: "Link deleted." });
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Failed to delete link" });
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      toast({ kind: "success", message: "Link copied." });
    } catch {
      toast({ kind: "error", message: "Couldn't copy link." });
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-x-0 top-12 mx-auto w-full max-w-2xl px-4">
        <div className="max-h-[80vh] overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)] shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border-2)] p-4">
            <div>
              <div className="text-sm font-semibold">Manage share links</div>
              <div className="text-xs text-[var(--text-muted)]">{galleryTitle}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-y-auto p-4 space-y-3">
            {loading && <div className="text-sm text-[var(--text-muted)]">Loading…</div>}

            {error && (
              <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}

            {!loading && !error && shares?.length === 0 && (
              <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/30 p-4 text-sm text-[var(--text-muted)]">
                No share links yet for this gallery.
              </div>
            )}

            {shares?.map((s) => (
              <div
                key={s.id}
                className={[
                  "rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/20 p-3",
                  s.revokedAt ? "opacity-60" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-[var(--text-1)]">
                        {s.contactName || "Unlabeled link"}
                      </div>
                      <span className="shrink-0 rounded-full border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">
                        {s.kind === "gallery" ? "Gallery" : `Video: ${s.label}`}
                      </span>
                      {s.revokedAt && (
                        <span className="shrink-0 rounded-full border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--danger)]">
                          Revoked
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Created {fmtDate(s.createdAt)} · {expiryLabel(s.expiresAt)}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyLink(s.url)}
                      title="Copy link"
                      aria-label="Copy link"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteShare(s)}
                      disabled={busyId === s.id}
                      title="Delete link"
                      aria-label="Delete link"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-2)] hover:bg-[var(--danger)]/15 hover:text-[var(--danger)] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                    <input
                      type="checkbox"
                      checked={s.allowComments}
                      disabled={busyId === s.id}
                      onChange={(e) => updateShare(s.id, { allowComments: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Comments
                  </label>

                  <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                    <input
                      type="checkbox"
                      checked={s.allowDownload}
                      disabled={busyId === s.id}
                      onChange={(e) => updateShare(s.id, { allowDownload: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Downloads
                  </label>

                  <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                    <span>Expires</span>
                    <select
                      defaultValue=""
                      disabled={busyId === s.id}
                      onChange={(e) => {
                        const days = e.target.value === "never" ? null : Number(e.target.value);
                        updateShare(s.id, { expiresInDays: days });
                        e.target.value = "";
                      }}
                      className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-xs"
                    >
                      <option value="" disabled>
                        Change…
                      </option>
                      {EXPIRY_OPTIONS.map((o) => (
                        <option key={o.label} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                    <input
                      type="checkbox"
                      checked={Boolean(s.revokedAt)}
                      disabled={busyId === s.id}
                      onChange={(e) => updateShare(s.id, { revoked: e.target.checked })}
                      className="h-4 w-4 accent-[var(--danger)]"
                    />
                    Revoked
                  </label>

                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
