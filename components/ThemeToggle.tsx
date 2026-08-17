"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import Button from "@/components/ui/Button";

type ThemeChoice = "system" | "dark" | "light";
type ResolvedTheme = "dark" | "light";

function isThemeChoice(x: unknown): x is ThemeChoice {
  return x === "system" || x === "dark" || x === "light";
}

function resolveEffectiveTheme(args: {
  theme?: string | null;
  resolvedTheme?: string | null;
  systemTheme?: string | null;
}): ResolvedTheme {
  const t = args.theme ?? undefined;
  const rt = args.resolvedTheme ?? undefined;
  const st = args.systemTheme ?? undefined;

  // next-themes often provides resolvedTheme; it’s usually the best “actual” answer.
  // But be defensive and fall back safely.
  const pick = (x?: string) => (x === "dark" ? "dark" : "light");

  if (t === "dark" || t === "light") return t;
  if (t === "system") {
    // Prefer resolvedTheme first, then systemTheme, then default to light.
    if (rt === "dark" || rt === "light") return rt;
    if (st === "dark" || st === "light") return st;
    return "light";
  }

  // If theme is undefined on first mount, resolvedTheme might still be set.
  if (rt === "dark" || rt === "light") return rt;
  if (st === "dark" || st === "light") return st;

  return "light";
}

function postToParent(message: any) {
  // If not embedded, this just no-ops.
  if (typeof window === "undefined") return;
  if (window.parent === window) return;
  window.parent.postMessage(message, "*");
}

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Used to avoid “echo” loops when parent + iframe both talk.
  const [lastExternalTheme, setLastExternalTheme] = useState<ThemeChoice | null>(null);

  useEffect(() => setMounted(true), []);

  const effective = useMemo(
    () =>
      resolveEffectiveTheme({
        theme,
        resolvedTheme,
        systemTheme,
      }),
    [theme, resolvedTheme, systemTheme]
  );

  const setThemeSafe = useCallback(
    (next: ThemeChoice, source: "ui" | "parent") => {
      setTheme(next);

      // Tell parent what we just set so the wrapper can sync (when you build it).
      postToParent({
        type: "FILMNOTES_THEME_CHANGE",
        payload: { theme: next, effective },
        source,
      });
    },
    [setTheme, effective]
  );

  // Listen for parent (GHL wrapper) to tell us what theme to use.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== "object") return;

      // You’ll implement this in your wrapper later.
      if (data.type === "FILMNOTES_SET_THEME") {
        const next = data?.payload?.theme;
        if (!isThemeChoice(next)) return;

        // Avoid repeated re-setting
        if (next === theme) return;

        setLastExternalTheme(next);
        setThemeSafe(next, "parent");
      }

      // Optional: parent asks “what theme are you using?”
      if (data.type === "FILMNOTES_GET_THEME") {
        postToParent({
          type: "FILMNOTES_THEME_STATE",
          payload: { theme, effective, resolvedTheme, systemTheme },
        });
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [theme, effective, resolvedTheme, systemTheme, setThemeSafe]);

  // On first mount (and when effective changes), announce to parent.
  useEffect(() => {
    if (!mounted) return;

    postToParent({
      type: "FILMNOTES_THEME_READY",
      payload: {
        theme,
        effective,
        resolvedTheme,
        systemTheme,
        lastExternalTheme,
      },
    });
  }, [mounted, theme, effective, resolvedTheme, systemTheme, lastExternalTheme]);

  if (!mounted) return null;

  const pressed = (choice: ThemeChoice) => theme === choice;

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold">Theme</div>
        <div className="text-xs text-[var(--text-muted)]">Current: {effective}</div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={pressed("system") ? "primary" : "secondary"}
          size="sm"
          onClick={() => setThemeSafe("system", "ui")}
          aria-pressed={pressed("system")}
        >
          System
        </Button>

        <Button
          variant={pressed("dark") ? "primary" : "secondary"}
          size="sm"
          onClick={() => setThemeSafe("dark", "ui")}
          aria-pressed={pressed("dark")}
        >
          Dark
        </Button>

        <Button
          variant={pressed("light") ? "primary" : "secondary"}
          size="sm"
          onClick={() => setThemeSafe("light", "ui")}
          aria-pressed={pressed("light")}
        >
          Light
        </Button>
      </div>
    </div>
  );
}