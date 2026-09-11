"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Copy, Trash2, Link2, Lock, LockOpen, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import Button from "@/components/ui/Button";

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
  hasPassword: boolean;
  contactName: string | null;
  url: string;
};

type ShareVideoRow = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  allowComments: boolean;
  allowDownload: boolean;
  hasOverride: boolean;
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
  const [editingPasswordFor, setEditingPasswordFor] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [videosByShareId, setVideosByShareId] = useState<Record<string, ShareVideoRow[]>>({});
  const [videosLoadingId, setVideosLoadingId] = useState<string | null>(null);
  const [videoBusyKey, setVideoBusyKey] = useState<string | null>(null);

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
    patch: {
      allowComments?: boolean;
      allowDownload?: boolean;
      expiresInDays?: number | null;
      revoked?: boolean;
      password?: string | null;
    }
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
                    hasPassword: data.share?.hasPassword ?? s.hasPassword,
                  }
                : s
            )
          : prev
      );
      if ("password" in patch) {
        setEditingPasswordFor(null);
        setPasswordDraft("");
        toast({ kind: "success", message: patch.password ? "Password set." : "Password removed." });
      }
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

  async function toggleExpanded(share: ShareRow) {
    if (expandedId === share.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(share.id);
    if (videosByShareId[share.id]) return; // already loaded

    setVideosLoadingId(share.id);
    try {
      const res = await fetch(`/api/owner/shares/${share.id}/videos`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load videos");
      setVideosByShareId((prev) => ({ ...prev, [share.id]: data.videos as ShareVideoRow[] }));
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Failed to load videos" });
      setExpandedId(null);
    } finally {
      setVideosLoadingId(null);
    }
  }

  async function setVideoPermission(
    shareId: string,
    videoId: string,
    patch: { allowComments?: boolean; allowDownload?: boolean } | { reset: true }
  ) {
    const key = `${shareId}:${videoId}`;
    setVideoBusyKey(key);
    try {
      const res = await fetch(`/api/owner/shares/${shareId}/video-permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to update video permissions");

      setVideosByShareId((prev) => ({
        ...prev,
        [shareId]: (prev[shareId] ?? []).map((v) => (v.id === videoId ? { ...v, ...data.video } : v)),
      }));
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Failed to update video permissions" });
    } finally {
      setVideoBusyKey(null);
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
                      {s.hasPassword && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">
                          <Lock className="h-3 w-3" />
                          Password protected
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

                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => {
                      if (editingPasswordFor === s.id) {
                        setEditingPasswordFor(null);
                      } else {
                        setEditingPasswordFor(s.id);
                        setPasswordDraft("");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] disabled:opacity-50"
                  >
                    {s.hasPassword ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                    {s.hasPassword ? "Change password" : "Set password"}
                  </button>

                  {s.kind === "gallery" && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(s)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]"
                    >
                      {expandedId === s.id ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      Per-video permissions
                    </button>
                  )}

                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className={[
                      "inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]",
                      s.kind === "gallery" ? "" : "ml-auto",
                    ].join(" ")}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Open
                  </a>
                </div>

                {s.kind === "gallery" && expandedId === s.id && (
                  <div className="mt-3 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/30 p-3">
                    {videosLoadingId === s.id ? (
                      <div className="text-xs text-[var(--text-muted)]">Loading videos…</div>
                    ) : (videosByShareId[s.id] ?? []).length === 0 ? (
                      <div className="text-xs text-[var(--text-muted)]">No videos in this link.</div>
                    ) : (
                      <div className="flex flex-col divide-y divide-[var(--border-2)]">
                        {(videosByShareId[s.id] ?? []).map((v) => {
                          const vBusy = videoBusyKey === `${s.id}:${v.id}`;
                          return (
                            <div key={v.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                              {v.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={v.thumbnailUrl}
                                  alt=""
                                  className="h-9 w-16 shrink-0 rounded-md border border-[var(--border-1)] object-cover"
                                />
                              ) : (
                                <div className="h-9 w-16 shrink-0 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)]" />
                              )}

                              <div className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text-1)]">
                                {v.title}
                              </div>

                              <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--text-2)]">
                                <input
                                  type="checkbox"
                                  checked={v.allowComments}
                                  disabled={vBusy}
                                  onChange={(e) =>
                                    setVideoPermission(s.id, v.id, { allowComments: e.target.checked })
                                  }
                                  className="h-3.5 w-3.5"
                                />
                                Comments
                              </label>

                              <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--text-2)]">
                                <input
                                  type="checkbox"
                                  checked={v.allowDownload}
                                  disabled={vBusy}
                                  onChange={(e) =>
                                    setVideoPermission(s.id, v.id, { allowDownload: e.target.checked })
                                  }
                                  className="h-3.5 w-3.5"
                                />
                                Downloads
                              </label>

                              {v.hasOverride && (
                                <button
                                  type="button"
                                  disabled={vBusy}
                                  onClick={() => setVideoPermission(s.id, v.id, { reset: true })}
                                  className="shrink-0 text-[11px] font-semibold text-[var(--text-3)] hover:text-[var(--text-1)] disabled:opacity-50"
                                  title="Reset to this link's default"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {editingPasswordFor === s.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={passwordDraft}
                      onChange={(e) => setPasswordDraft(e.target.value)}
                      placeholder={s.hasPassword ? "New password" : "Set a password"}
                      className="flex-1 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-2)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--border-3)]"
                    />
                    <Button
                      size="sm"
                      disabled={busyId === s.id || !passwordDraft}
                      onClick={() => updateShare(s.id, { password: passwordDraft })}
                    >
                      Save
                    </Button>
                    {s.hasPassword && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === s.id}
                        onClick={() => updateShare(s.id, { password: null })}
                      >
                        Remove
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingPasswordFor(null);
                        setPasswordDraft("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
