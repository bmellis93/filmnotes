"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Check } from "lucide-react";

export type GallerySortField =
  | "CREATED_AT"
  | "UPDATED_AT"
  | "LAST_CLIENT_COMMENT"
  | "ALPHA";

export type SortDir = "ASC" | "DESC";

export type GallerySort = {
  field: GallerySortField;
  dir: SortDir;
};

const btnBase =
  "inline-flex items-center gap-2 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)] transition";

export default function GallerySortMenu({
  value,
  onChange,
}: {
  value: GallerySort;
  onChange: (next: GallerySort) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const items = useMemo(
    () => [
      { field: "CREATED_AT" as const, label: "Created date" },
      { field: "UPDATED_AT" as const, label: "Last edited" },
      { field: "LAST_CLIENT_COMMENT" as const, label: "Last client commented" },
      { field: "ALPHA" as const, label: "Alphabetical" },
    ],
    []
  );

  const dirLabel = value.dir === "ASC" ? "Asc" : "Desc";
  const activeItem = items.find((i) => i.field === value.field);
  const activeLabel = activeItem?.label ?? "Sort";

  function close() {
    setOpen(false);
    // return focus to trigger for keyboard users
    buttonRef.current?.focus();
  }

  function setField(field: GallerySortField) {
    onChange({ ...value, field });
    close();
  }

  function toggleDir() {
    onChange({ ...value, dir: value.dir === "ASC" ? "DESC" : "ASC" });
    close();
  }

  // Click outside + Escape to close
  useEffect(() => {
    if (!open) return;

    function onDocMouseDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) close();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Simple keyboard navigation inside the menu (ArrowUp/Down + Enter/Space)
  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!open) return;

    const container = rootRef.current;
    if (!container) return;

    const focusables = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[data-menu-item="true"]')
    );

    if (focusables.length === 0) return;

    const currentIndex = focusables.findIndex((b) => b === document.activeElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = focusables[(currentIndex + 1 + focusables.length) % focusables.length];
      next?.focus();
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = focusables[(currentIndex - 1 + focusables.length) % focusables.length];
      prev?.focus();
    }

    if (e.key === "Home") {
      e.preventDefault();
      focusables[0]?.focus();
    }

    if (e.key === "End") {
      e.preventDefault();
      focusables[focusables.length - 1]?.focus();
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={btnBase}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="gallery-sort-menu"
      >
        <ArrowUpDown className="h-4 w-4" />
        Sort
      </button>

      <div
        id="gallery-sort-menu"
        role="menu"
        aria-label="Gallery sort menu"
        onKeyDown={onMenuKeyDown}
        className={[
          "absolute right-0 z-20 mt-2 w-50 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)] p-2 shadow-xl",
          "origin-top-right transition duration-150 focus:outline-none",
          open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95",
        ].join(" ")}
      >
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Sort by
        </div>

        <div className="space-y-1">
          {items.map((i) => {
            const active = value.field === i.field;

            return (
              <button
                key={i.field}
                ref={(el) => {
                  itemRefs.current[i.field] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                data-menu-item="true"
                tabIndex={-1}
                onClick={() => setField(i.field)}
                onMouseEnter={() => itemRefs.current[i.field]?.focus()}
                className={[
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs outline-none",
                  active
                    ? "bg-[var(--accent-solid-hover)] text-[var(--accent-solid-fg)]"
                    : "text-[var(--text-2)] focus:bg-[var(--surface-1)] focus-visible:bg-[var(--surface-1)]",
                ].join(" ")}
              >
                <span>{i.label}</span>
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>

        <div className="mt-2 border-t border-[var(--border-1)] pt-2">
          <button
            type="button"
            role="menuitem"
            data-menu-item="true"
            tabIndex={-1}
            onClick={toggleDir}
            className={[
              "w-full rounded-xl px-3 py-2 text-left text-xs text-[var(--text-2)] hover:bg-[var(--surface-1)] outline-none",
              "focus:ring-2 focus:ring-[var(--border-3)]",
            ].join(" ")}
          >
            Direction: <span className="font-semibold">{dirLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}