import type { ReactNode } from "react";

export type LegalDocTocEntry = { id: string; label: string };

export default function LegalDoc({
  title,
  updated,
  toc,
  children,
}: {
  title: string;
  updated: string;
  /** Optional "on this page" section nav — renders a sidebar on larger screens. */
  toc?: LegalDocTocEntry[];
  children: ReactNode;
}) {
  const content = (
    <div
      className="
        flex flex-col gap-6
        [&_h2]:mt-2 [&_h2]:scroll-mt-24 [&_h2]:text-xl
        [&_h3]:mt-1 [&_h3]:text-base
        [&_p]:text-[var(--text-2)] [&_p]:leading-relaxed
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-[var(--text-2)] [&_ul]:leading-relaxed [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5
        [&_a]:text-[var(--cue)] [&_a]:underline [&_a]:underline-offset-2
        [&_strong]:text-[var(--text-1)]
      "
    >
      {children}
    </div>
  );

  return (
    <article className={`mx-auto px-4 py-16 sm:px-6 sm:py-20 ${toc?.length ? "max-w-5xl" : "max-w-3xl"}`}>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">Last updated {updated}</p>

      {toc?.length ? (
        <div className="mt-10 grid gap-10 lg:grid-cols-[200px_1fr]">
          <nav className="lg:sticky lg:top-24 lg:h-fit">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              On this page
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {toc.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    className="text-[var(--text-3)] transition hover:text-[var(--text-1)]"
                  >
                    {entry.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {content}
        </div>
      ) : (
        <div className="mt-10">{content}</div>
      )}
    </article>
  );
}
