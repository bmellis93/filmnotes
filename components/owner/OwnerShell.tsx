"use client";

import { ReactNode, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Search, Settings, PanelLeft } from "lucide-react";
import { usePersistedState } from "@/components/owner/hooks/usePersistedState";
import { LogoMark } from "@/components/brand/Logo";

type Props = {
  children: ReactNode;
  title?: string;
};

const APP_NAME = "FilmNotes";

const navItemBase =
  "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)]";
const navItemActive = "bg-[var(--surface-1)] text-[var(--text-1)] ring-1 ring-[var(--border-1)]";
const navItemInactive = "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-1)]/60";

export default function OwnerShell({ children }: Props) {
  const pathname = usePathname();

  const { value: collapsed, setValue: setCollapsed, hydrated } =
    usePersistedState<boolean>("owner:shellCollapsed", false);

  const nav = useMemo(
    () => [
      { href: "/owner/galleries", label: "Galleries", icon: LayoutGrid },
      { href: "/owner/search", label: "Search", icon: Search },
    ],
    []
  );

  function isActive(href: string) {
    return pathname === href || (pathname?.startsWith(href + "/") ?? false);
  }

  // While not hydrated, render as uncollapsed to avoid a layout jump
  const collapsedUI = hydrated ? collapsed : false;

  return (
    <div className="h-[100dvh] bg-[var(--surface-0)] text-[var(--text-1)]">
      <div className="flex h-full min-h-0">
        {/* LEFT SIDEBAR */}
        <aside
          className={[
            "flex h-full min-h-0 shrink-0 flex-col border-r border-[var(--border-2)] bg-[var(--surface-0)]/80 backdrop-blur",
            "transition-[width] duration-200 ease-in-out",
            collapsedUI ? "w-[76px]" : "w-[240px]",
          ].join(" ")}
        >
          {/* top brand + collapse */}
          <div className="flex items-center justify-between px-3 py-3">
            <Link
              href="/owner/galleries"
              className="flex items-center gap-3 overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)]"
              aria-label={`${APP_NAME} owner home`}
              title={collapsedUI ? APP_NAME : undefined}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-1)] ring-1 ring-[var(--border-1)]">
                <LogoMark className="h-6 w-6 text-[var(--text-1)]" />
              </div>

              {!collapsedUI && (
                <div className="leading-tight">
                  <div className="text-sm font-semibold">{APP_NAME}</div>
                  <div className="text-xs text-[var(--text-muted)]">Owner</div>
                </div>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)]"
              aria-label={collapsedUI ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsedUI ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          </div>

          {/* nav */}
          <nav className="px-2" aria-label="Owner navigation">
            <div className="space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsedUI ? item.label : undefined}
                    className={[
                      navItemBase,
                      active ? navItemActive : navItemInactive,
                      collapsedUI ? "justify-center" : "",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsedUI && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="flex-1" />

          {/* bottom settings */}
          <div className="px-2 pb-3">
            <Link
              href="/owner/settings"
              title={collapsedUI ? "Settings" : undefined}
              className={[
                navItemBase,
                isActive("/owner/settings") ? navItemActive : navItemInactive,
                collapsedUI ? "justify-center" : "",
              ].join(" ")}
              aria-current={isActive("/owner/settings") ? "page" : undefined}
            >
              <Settings className="h-5 w-5 shrink-0" />
              {!collapsedUI && <span className="truncate">Settings</span>}
            </Link>
          </div>
        </aside>

        {/* MAIN */}
        <main className="min-w-0 flex-1">
          <div className="h-full min-h-0 overflow-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}