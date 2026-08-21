"use client";

import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Search, Settings, PanelLeft, Menu } from "lucide-react";
import { usePersistedState } from "@/components/owner/hooks/usePersistedState";
import { LogoMark } from "@/components/brand/Logo";
import { useOwnerRole } from "@/components/owner/OwnerRoleContext";

type Props = {
  children: ReactNode;
  title?: string;
  // Overridden to "/embed" when rendered inside the GHL embed (see
  // components/embed/EmbedShell.tsx), same basePath convention used
  // elsewhere -- keeps every nav link inside /embed/* instead of the
  // standalone app's cookie-authenticated /owner/* routes.
  basePath?: string;
};

const APP_NAME = "FilmNotes";

const navItemBase =
  "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)]";
const navItemActive = "bg-[var(--surface-1)] text-[var(--text-1)] ring-1 ring-[var(--border-1)]";
const navItemInactive = "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-1)]/60";

export default function OwnerShell({ children, basePath = "/owner" }: Props) {
  const pathname = usePathname();
  const { hasRole } = useOwnerRole();

  const { value: collapsed, setValue: setCollapsed, hydrated } =
    usePersistedState<boolean>("owner:shellCollapsed", false);

  // Drawer state on <lg, not persisted -- shouldn't remember "open" across
  // navigations the way the desktop collapse preference correctly does.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const nav = useMemo(
    () => [
      { href: `${basePath}/galleries`, label: "Galleries", icon: LayoutGrid },
      { href: `${basePath}/search`, label: "Search", icon: Search },
    ],
    [basePath]
  );

  function isActive(href: string) {
    return pathname === href || (pathname?.startsWith(href + "/") ?? false);
  }

  // While not hydrated, render as uncollapsed to avoid a layout jump
  const collapsedUI = hydrated ? collapsed : false;

  return (
    <div className="h-[100dvh] bg-[var(--surface-0)] text-[var(--text-1)]">
      {/* MOBILE TOP BAR (<lg only) -- restores access to nav once the
          sidebar becomes an off-canvas drawer below lg. */}
      <div className="flex h-14 items-center gap-3 border-b border-[var(--border-2)] bg-[var(--surface-0)]/80 px-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)]"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <LogoMark className="h-6 w-6 text-[var(--text-1)]" />
        <span className="text-sm font-semibold">{APP_NAME}</span>
      </div>

      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 lg:h-full">
        {/* Backdrop (<lg only, when drawer open) */}
        {mobileNavOpen && (
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          />
        )}

        {/* LEFT SIDEBAR -- fixed off-canvas drawer <lg, static sidebar lg: and up */}
        <aside
          className={[
            "flex h-full min-h-0 shrink-0 flex-col border-r border-[var(--border-2)] bg-[var(--surface-0)] backdrop-blur lg:bg-[var(--surface-0)]/80",
            "fixed inset-y-0 left-0 z-40 w-[240px] transition-transform duration-200 ease-in-out",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full",
            "lg:static lg:z-auto lg:translate-x-0 lg:transition-[width]",
            collapsedUI ? "lg:w-[76px]" : "lg:w-[240px]",
          ].join(" ")}
        >
          {/* top brand + collapse */}
          <div className="flex items-center justify-between px-3 py-3">
            <Link
              href={`${basePath}/galleries`}
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-3 overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)]"
              aria-label={`${APP_NAME} owner home`}
              title={collapsedUI ? APP_NAME : undefined}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-1)] ring-1 ring-[var(--border-1)]">
                <LogoMark className="h-6 w-6 text-[var(--text-1)]" />
              </div>

              <div className={["leading-tight", collapsedUI ? "lg:hidden" : ""].join(" ")}>
                <div className="text-sm font-semibold">{APP_NAME}</div>
                <div className="text-xs text-[var(--text-muted)]">Owner</div>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="hidden h-10 w-10 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)] lg:inline-flex"
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
                    onClick={() => setMobileNavOpen(false)}
                    aria-current={active ? "page" : undefined}
                    title={collapsedUI ? item.label : undefined}
                    className={[
                      navItemBase,
                      active ? navItemActive : navItemInactive,
                      collapsedUI ? "lg:justify-center" : "",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className={["truncate", collapsedUI ? "lg:hidden" : ""].join(" ")}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="flex-1" />

          {/* bottom settings */}
          {hasRole("ADMIN") && (
            <div className="px-2 pb-3">
              <Link
                href={`${basePath}/settings`}
                onClick={() => setMobileNavOpen(false)}
                title={collapsedUI ? "Settings" : undefined}
                className={[
                  navItemBase,
                  isActive(`${basePath}/settings`) ? navItemActive : navItemInactive,
                  collapsedUI ? "lg:justify-center" : "",
                ].join(" ")}
                aria-current={isActive(`${basePath}/settings`) ? "page" : undefined}
              >
                <Settings className="h-5 w-5 shrink-0" />
                <span className={["truncate", collapsedUI ? "lg:hidden" : ""].join(" ")}>Settings</span>
              </Link>
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main className="min-w-0 flex-1">
          <div className="h-full min-h-0 overflow-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}