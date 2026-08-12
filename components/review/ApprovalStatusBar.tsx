"use client";

import { Check, MessageSquareWarning, Clock, Eye } from "lucide-react";

export type ApprovalStatus = "PENDING" | "CHANGES_REQUESTED" | "APPROVED";

export type ViewInfo = { firstViewedAt: string; lastViewedAt: string; viewCount: number };

type Props = {
  isOwner: boolean;
  canAct: boolean;

  status: ApprovalStatus;
  updatedAt: string | null;

  isSubmitting: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;

  /** Owner-only: when the client(s) opened this video, if ever. */
  viewInfo?: ViewInfo | null;
};

function safeDateLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusMeta(status: ApprovalStatus) {
  switch (status) {
    case "APPROVED":
      return {
        label: "Approved",
        icon: Check,
        cls: "border-emerald-900/50 bg-emerald-950/40 text-emerald-700 dark:text-emerald-200",
      };
    case "CHANGES_REQUESTED":
      return {
        label: "Changes requested",
        icon: MessageSquareWarning,
        cls: "border-amber-900/50 bg-amber-950/40 text-amber-700 dark:text-amber-200",
      };
    default:
      return {
        label: "Pending review",
        icon: Clock,
        cls: "border-[var(--border-1)] bg-[var(--surface-1)]/60 text-[var(--text-2)]",
      };
  }
}

export default function ApprovalStatusBar({
  isOwner,
  canAct,
  status,
  updatedAt,
  isSubmitting,
  onApprove,
  onRequestChanges,
  viewInfo,
}: Props) {
  const meta = statusMeta(status);
  const Icon = meta.icon;
  const dateLabel = safeDateLabel(updatedAt);

  // Owner: read-only, and only worth showing once there's something to report.
  if (isOwner) {
    if (status === "PENDING" && !viewInfo) return null;

    const viewedLabel = viewInfo ? safeDateLabel(viewInfo.firstViewedAt) : null;

    return (
      <div className="shrink-0 border-b border-[var(--border-1)] bg-[var(--surface-0)]/60 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {status !== "PENDING" && (
            <span
              className={[
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                meta.cls,
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
              {dateLabel && <span className="font-normal opacity-75">· {dateLabel}</span>}
            </span>
          )}

          {viewInfo && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-1)] bg-[var(--surface-1)]/60 px-2.5 py-1 text-xs font-semibold text-[var(--text-2)]">
              <Eye className="h-3.5 w-3.5" />
              Viewed{viewedLabel ? ` ${viewedLabel}` : ""}
              {viewInfo.viewCount > 1 && (
                <span className="font-normal opacity-75">· {viewInfo.viewCount}x</span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (!canAct) return null;

  return (
    <div className="shrink-0 border-b border-neutral-800 bg-neutral-950/60 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
            meta.cls,
          ].join(" ")}
        >
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
          {dateLabel && <span className="font-normal opacity-75">· {dateLabel}</span>}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRequestChanges}
            disabled={isSubmitting}
            className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            Request changes
          </button>

          <button
            type="button"
            onClick={onApprove}
            disabled={isSubmitting || status === "APPROVED"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {status === "APPROVED" ? "Approved" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
