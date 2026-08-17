import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type PillTone = "neutral" | "success" | "warning" | "danger";

const toneClasses: Record<PillTone, string> = {
  neutral: "border-[var(--border-1)] bg-[var(--surface-1)]/60 text-[var(--text-2)]",
  success: "border-[var(--success)]/30 bg-[var(--success)]/15 text-[var(--success)]",
  warning: "border-[var(--warning)]/30 bg-[var(--warning)]/15 text-[var(--warning)]",
  danger: "border-[var(--danger)]/30 bg-[var(--danger)]/15 text-[var(--danger)]",
};

type Props = {
  tone?: PillTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
};

/** Rounded status badge — comment open/resolved, approval state, video status, etc. */
export default function StatusPill({ tone = "neutral", icon: Icon, children, className }: Props) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className ?? "",
      ].join(" ")}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}
