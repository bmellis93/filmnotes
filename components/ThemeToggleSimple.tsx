"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check } from "lucide-react";

type ThemeChoice = "system" | "dark" | "light";

const items: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
];

// Compact icon-button + dropdown for client-facing pages that don't have a
// full settings screen. Same System/Dark/Light choices as the owner
// Settings screen's ThemeToggle, just collapsed into one trigger to fit a
// tight header. Defaults to system (see app/providers.tsx); tapping an
// option sets an explicit override, stored per-browser like any next-themes
// choice (not shared between the owner and their clients).
export default function ThemeToggleSimple() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

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

  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden="true" />;
  }

  const current = items.find((i) => i.value === theme) ?? items[0];
  const CurrentIcon = current.icon;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        title={`Theme: ${current.label}`}
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      <div
        role="menu"
        aria-label="Theme menu"
        className={[
          "absolute right-0 z-20 mt-2 w-36 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)] p-2 shadow-xl",
          "origin-top-right transition duration-150 focus:outline-none",
          open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95",
        ].join(" ")}
      >
        <div className="space-y-1">
          {items.map((i) => {
            const Icon = i.icon;
            const active = theme === i.value;

            return (
              <button
                key={i.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(i.value);
                  close();
                }}
                className={[
                  "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs outline-none",
                  active
                    ? "bg-[var(--accent-solid-hover)] text-[var(--accent-solid-fg)]"
                    : "text-[var(--text-2)] hover:bg-[var(--surface-1)] focus-visible:bg-[var(--surface-1)]",
                ].join(" ")}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  {i.label}
                </span>
                {active && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
