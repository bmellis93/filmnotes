"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/Button";
import { GET_APP_URL, LOGIN_URL } from "@/lib/marketing/links";

const navLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/support", label: "Support" },
];

export default function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-2)] bg-[var(--surface-0)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)] rounded-lg">
          <Logo markClassName="h-6 w-6 text-[var(--text-1)]" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href={LOGIN_URL} className={buttonVariants({ variant: "ghost", size: "md" })}>
            Sign in
          </Link>
          <a href={GET_APP_URL} className={buttonVariants({ variant: "primary", size: "md" })}>
            Get the app
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-1)] md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--border-2)] bg-[var(--surface-0)] px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={LOGIN_URL}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]"
            >
              Sign in
            </Link>
            <a
              href={GET_APP_URL}
              className={buttonVariants({ variant: "primary", className: "mt-2 w-full" })}
            >
              Get the app
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
