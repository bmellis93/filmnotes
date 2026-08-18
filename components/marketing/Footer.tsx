import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

const columns = [
  {
    heading: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
    ],
  },
  {
    heading: "Company",
    links: [{ href: "mailto:support@filmnotes.app", label: "support@filmnotes.app" }],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--border-2)] bg-[var(--surface-0)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5">
              <LogoMark className="h-6 w-6 text-[var(--text-1)]" />
              <span className="text-base font-semibold tracking-tight text-[var(--text-1)]">
                FilmNotes
              </span>
            </div>
            <p className="mt-3 max-w-[22ch] text-sm text-[var(--text-3)]">
              Timestamped video review and approval, built into HighLevel.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <h6 className="mb-3">{col.heading}</h6>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--text-3)] transition hover:text-[var(--text-1)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-[var(--border-2)] pt-6 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Renowned Media, LLC. All rights reserved.</p>
          <p>FilmNotes is not affiliated with or endorsed by HighLevel Inc.</p>
        </div>
      </div>
    </footer>
  );
}
