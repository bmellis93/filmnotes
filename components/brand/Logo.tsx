// Viewfinder-bracket mark with the "cue mark" dot — see public/brand/brand-guide.md.
// Brackets use currentColor so they adapt to light/dark automatically; the
// dot stays the one saturated element (Cue), as the guide specifies.

type MarkProps = { className?: string };

export function LogoMark({ className = "h-6 w-6 text-[var(--text-1)]" }: MarkProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="7" strokeLinecap="round">
        <path d="M27 24 H16 V35" />
        <path d="M73 24 H84 V35" />
        <path d="M27 76 H16 V65" />
        <path d="M73 76 H84 V65" />
      </g>
      <circle cx="69" cy="69" r="8.5" fill="var(--accent-solid)" />
    </svg>
  );
}

type LogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

/** Mark + wordmark lockup, for headers and sign-in screens. */
export function Logo({ className, markClassName, textClassName }: LogoProps) {
  return (
    <span className={["inline-flex items-center gap-2.5", className ?? ""].join(" ")}>
      <LogoMark className={markClassName} />
      <span
        className={[
          "text-base font-semibold tracking-tight text-[var(--text-1)]",
          textClassName ?? "",
        ].join(" ")}
      >
        FilmNotes
      </span>
    </span>
  );
}
