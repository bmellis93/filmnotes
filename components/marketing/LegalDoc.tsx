import type { ReactNode } from "react";

export default function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">Last updated {updated}</p>

      <div
        className="
          mt-10 flex flex-col gap-6
          [&_h2]:mt-2 [&_h2]:text-xl
          [&_h3]:mt-1 [&_h3]:text-base
          [&_p]:text-[var(--text-2)] [&_p]:leading-relaxed
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-[var(--text-2)] [&_ul]:leading-relaxed [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5
          [&_a]:text-[var(--cue)] [&_a]:underline [&_a]:underline-offset-2
          [&_strong]:text-[var(--text-1)]
        "
      >
        {children}
      </div>
    </article>
  );
}
