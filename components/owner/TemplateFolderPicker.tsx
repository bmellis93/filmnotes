"use client";

import { useEffect, useRef, useState } from "react";
import { Folder, FileText, ChevronRight, X, ArrowLeft } from "lucide-react";

type Item =
  | { id: string; type: "folder"; name: string; childCount: number }
  | { id: string; type: "template"; name: string; previewUrl: string | null; lastUpdated: string | null };

type Crumb = { id: string | null; name: string };

export type PickedTemplate = { id: string; name: string; previewUrl: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (template: PickedTemplate) => void;
};

const STORAGE_KEY = "ghl-email-builder-last-folder";

function loadLastFolder(): Crumb[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveLastFolder(trail: Crumb[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
  } catch {
    // best-effort only
  }
}

export default function TemplateFolderPicker({ open, onClose, onSelect }: Props) {
  const [trail, setTrail] = useState<Crumb[]>([{ id: null, name: "All templates" }]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loads are triggered imperatively (on open, and on every navigation) and
  // guarded by a request id so a slow, stale response can never clobber a
  // newer one -- fetch effects keyed on derived state raced here before.
  const requestIdRef = useRef(0);

  async function loadFolder(nextTrail: Crumb[]) {
    const folder = nextTrail[nextTrail.length - 1];
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    try {
      const url = folder.id
        ? `/api/ghl/email-builder-templates?parentId=${encodeURIComponent(folder.id)}`
        : "/api/ghl/email-builder-templates";

      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load templates");

      if (requestIdRef.current !== requestId) return; // a newer request has since started
      setItems(json.items ?? []);
      saveLastFolder(nextTrail);
    } catch (e: any) {
      if (requestIdRef.current !== requestId) return;
      setError(e?.message || "Failed to load templates");
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const remembered = loadLastFolder();
    const nextTrail = remembered && remembered.length > 0 ? remembered : [{ id: null, name: "All templates" }];
    setTrail(nextTrail);
    void loadFolder(nextTrail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function enterFolder(item: Extract<Item, { type: "folder" }>) {
    const nextTrail = [...trail, { id: item.id, name: item.name }];
    setTrail(nextTrail);
    void loadFolder(nextTrail);
  }

  function goToCrumb(index: number) {
    const nextTrail = trail.slice(0, index + 1);
    setTrail(nextTrail);
    void loadFolder(nextTrail);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      <div className="relative flex max-h-[80vh] w-[min(560px,94vw)] flex-col overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-1)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs text-[var(--text-muted)]">Email Builder</div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-sm font-semibold text-[var(--text-1)]">
              {trail.map((c, i) => (
                <span key={`${c.id ?? "root"}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                  <button
                    type="button"
                    onClick={() => goToCrumb(i)}
                    disabled={i === trail.length - 1}
                    className={i === trail.length - 1 ? "text-[var(--text-1)]" : "text-[var(--text-muted)] hover:text-[var(--text-1)]"}
                  >
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-2 text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {trail.length > 1 && (
            <button
              type="button"
              onClick={() => goToCrumb(trail.length - 2)}
              className="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--text-2)] hover:bg-[var(--surface-1)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}

          {loading ? (
            <div className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">Loading…</div>
          ) : error ? (
            <div className="mx-2 rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">Nothing in here.</div>
          ) : (
            <div className="space-y-1">
              {items.map((item) =>
                item.type === "folder" ? (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => enterFolder(item)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--surface-1)]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Folder className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                      <span className="truncate text-sm text-[var(--text-1)]">{item.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-muted)]">{item.childCount}</span>
                  </button>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect({ id: item.id, name: item.name, previewUrl: item.previewUrl })}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--surface-1)]"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                    <span className="truncate text-sm text-[var(--text-1)]">{item.name}</span>
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
