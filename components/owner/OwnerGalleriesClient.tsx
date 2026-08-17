// components/owner/OwnerGalleriesClient.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import GalleryCreateModal from "@/components/owner/GalleryCreateModal";
import GallerySortMenu, { GallerySort } from "@/components/owner/GallerySortMenu";
import { usePersistedState } from "@/components/owner/hooks/usePersistedState";
import GalleryCover from "@/components/owner/GalleryCover";
import StorageUsagePill from "@/components/owner/StorageUsagePill";
import Button from "@/components/ui/Button";
import { useOwnerRole } from "@/components/owner/OwnerRoleContext";

export type OwnerGalleryListItem = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  lastClientCommentedAt?: string | null;
  thumbs: { url: string; alt?: string }[]; // 0..4
  archivedAt?: string | null;
  deletedAt?: string | null;
};

const SORT_KEY = "owner:galleriesSort";
type CreateGalleryDraft = { name: string; description: string };

function safeTime(s?: string | null) {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function OwnerGalleriesClient({
  initialGalleries,
  basePath = "/owner/galleries",
}: {
  initialGalleries: OwnerGalleryListItem[];
  // Lets the embed dashboard (app/embed/galleries) reuse this component
  // unmodified while navigating within /embed/* instead of /owner/*.
  basePath?: string;
}) {
  const router = useRouter();
  const { hasRole } = useOwnerRole();
  const canManageGalleries = hasRole("CONTRIBUTOR");

  const [createOpen, setCreateOpen] = useState(false);
  const [galleries, setGalleries] = useState<OwnerGalleryListItem[]>(initialGalleries);
  const [creating, setCreating] = useState(false);

  const { value: sort, setValue: setSort } = usePersistedState<GallerySort>(SORT_KEY, {
    field: "UPDATED_AT",
    dir: "DESC",
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const showSelectionUI = selectedIds.length > 0;

  const [showArchived, setShowArchived] = useState(false);

  function toggleSelect(galleryId: string) {
    setSelectedIds((prev) =>
      prev.includes(galleryId) ? prev.filter((id) => id !== galleryId) : [...prev, galleryId]
    );
  }

  const sorted = useMemo(() => {
    const dir = sort.dir === "ASC" ? 1 : -1;

    const byDate = (a?: string | null, b?: string | null) => {
      const ta = safeTime(a);
      const tb = safeTime(b);
      return (ta - tb) * dir;
    };

    // filter first
    const base = showArchived
      ? galleries.filter((g) => !g.deletedAt)
      : galleries.filter((g) => !g.deletedAt && !g.archivedAt);

    // then sort
    const next = [...base];
    next.sort((a, b) => {
      if (sort.field === "CREATED_AT") return byDate(a.createdAt, b.createdAt);
      if (sort.field === "UPDATED_AT") return byDate(a.updatedAt, b.updatedAt);
      if (sort.field === "LAST_CLIENT_COMMENT")
        return byDate(a.lastClientCommentedAt, b.lastClientCommentedAt);

      const na = (a.name || "").toLowerCase();
      const nb = (b.name || "").toLowerCase();
      if (na === nb) return 0;
      return na > nb ? 1 * dir : -1 * dir;
    });

    return next;
  }, [galleries, sort, showArchived]);

  function fmtGBFromStringBytes(s: string) {
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0) return "0.0";
    const gb = n / (1024 * 1024 * 1024);
    return gb >= 10 ? gb.toFixed(0) : gb.toFixed(1);
  }
  
  async function createGallery(draft: CreateGalleryDraft, openAfter: boolean) {
    const name = draft.name.trim();
    const description = draft.description.trim();
    if (!name) return;

    setCreating(true);

    const tempId = `temp_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const optimistic: OwnerGalleryListItem = {
      id: tempId,
      name,
      description: description || "",
      createdAt: now,
      updatedAt: now,
      lastClientCommentedAt: null,
      thumbs: [],
      archivedAt: null,
      deletedAt: null,
    };

    setGalleries((prev) => [optimistic, ...prev]);
    setCreateOpen(false);

    try {
      const res = await fetch("/api/owner/galleries/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Create gallery failed (${res.status}): ${text}`);
      }

      const data = (await res.json()) as { ok: boolean; gallery: OwnerGalleryListItem };
      if (!data?.ok || !data?.gallery?.id) throw new Error("Create gallery returned invalid payload");

      const created = data.gallery;
      setGalleries((prev) => prev.map((g) => (g.id === tempId ? created : g)));

      if (openAfter) router.push(`${basePath}/${created.id}`);
    } catch (err) {
      console.error(err);
      setGalleries((prev) => prev.filter((g) => g.id !== tempId));
    } finally {
      setCreating(false);
    }
  }

  async function bulkArchive() {
    if (!confirm(`Archive ${selectedIds.length} gallery(s)?`)) return;

    const res = await fetch("/api/owner/galleries/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ARCHIVE", galleryIds: selectedIds }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      alert(`Archive failed: ${text || res.status}`);
      return;
    }

    const now = new Date().toISOString();
    setGalleries((prev) =>
      prev.map((g) => (selectedIds.includes(g.id) ? { ...g, archivedAt: now } : g))
    );
    setSelectedIds([]);
  }

  async function bulkDelete() {
    if (selectedIds.length === 0) return;

    // 1) preview freed storage (best-effort)
    let confirmText = `DELETE ${selectedIds.length} gallery(s)? This removes videos from Mux + R2.`;

    try {
      const prevRes = await fetch("/api/owner/galleries/bulk-delete-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ galleryIds: selectedIds }),
      });

      if (prevRes.ok) {
        const prev = (await prevRes.json().catch(() => null)) as
          | { ok: true; bytes: string }
          | { ok?: false; error?: string }
          | null;

        if (prev && (prev as any).ok) {
          const gb =
            typeof (prev as any).totalGb === "string"
              ? (prev as any).totalGb
              : fmtGBFromStringBytes((prev as any).bytes);

          confirmText = `Deleting these galleries will free about ${gb} GB.\n\nContinue?`;
        }
      }
    } catch {
      // ignore preview errors; keep default confirm
    }

    // 2) confirm
    if (!confirm(confirmText)) return;

    // 3) perform delete
    const res = await fetch("/api/owner/galleries/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", galleryIds: selectedIds }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      alert(`Delete failed: ${text || res.status}`);
      return;
    }

    setGalleries((prev) => prev.filter((g) => !selectedIds.includes(g.id)));
    setSelectedIds([]);
    router.refresh();
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--surface-0)] text-[var(--text-1)]">
      <div className="mx-auto w-full max-w-6xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Galleries</div>
            <div className="text-sm text-[var(--text-muted)]">
              Create galleries, upload videos, and send review links.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {showSelectionUI && canManageGalleries ? (
              <>
                <Button
                  variant="secondary"
                  title="Archived videos still count toward storage."
                  onClick={bulkArchive}
                >
                  Archive
                </Button>

                <Button variant="destructive" onClick={bulkDelete}>
                  Delete
                </Button>
              </>
            ) : null}

            <button
              type="button"
              title="Archived videos still count toward storage."
              onClick={() => setShowArchived((v) => !v)}
              className={[
                "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition",
                showArchived
                  ? "bg-[var(--accent-solid)]/15 text-[var(--accent-solid)] border border-[var(--accent-solid)]/40 hover:bg-[var(--accent-solid)]/25"
                  : "border border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-1)] hover:bg-[var(--surface-2)]",
              ].join(" ")}
            >
              {showArchived ? "Hide Archived" : "Show Archived"}
            </button>

            <GallerySortMenu value={sort} onChange={setSort} />

            <StorageUsagePill />

            {canManageGalleries && (
              <Button onClick={() => setCreateOpen(true)} disabled={creating}>
                <Plus className="h-4 w-4" />
                Gallery
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((g) => (
            <Link
              key={g.id}
              href={`${basePath}/${g.id}`}
              className="group relative rounded-3xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4 hover:bg-[var(--surface-1)]/40 hover:border-[var(--border-3)] transition"
            >
              {/* Hover checkbox */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleSelect(g.id);
                }}
                className={[
                  "absolute left-4 top-4 z-10 h-9 w-9 rounded-xl border border-[var(--border-3)] bg-black/40 backdrop-blur",
                  "flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition",
                  selectedIds.includes(g.id) ? "opacity-100" : "",
                ].join(" ")}
                aria-label="Select gallery"
                title="Select"
              >
                <div
                  className={[
                    "h-4 w-4 rounded border",
                    selectedIds.includes(g.id) ? "bg-[var(--accent-solid)] border-[var(--accent-solid)]" : "border-[var(--border-3)]",
                  ].join(" ")}
                />
              </button>

              <GalleryCover thumbs={g.thumbs} />

              <div className="mt-3">
                <div className="text-sm font-semibold text-[var(--text-1)]">{g.name}</div>
                {g.description ? (
                  <div className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{g.description}</div>
                ) : (
                  <div className="mt-1 text-xs text-[var(--text-muted)]">No description</div>
                )}
              </div>

              <div className="mt-4 text-[11px] text-[var(--text-muted)]">
                Created {new Date(g.createdAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <GalleryCreateModal
        open={createOpen}
        onClose={() => (creating ? null : setCreateOpen(false))}
        onCreate={(draft) => createGallery(draft, false)}
        onCreateAndOpen={(draft) => createGallery(draft, true)}
      />
    </div>
  );
}