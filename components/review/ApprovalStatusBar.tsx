"use client";

import { Check, MessageSquareWarning, Clock, Eye, type LucideIcon } from "lucide-react";
import Button from "@/components/ui/Button";
import StatusPill, { type PillTone } from "@/components/ui/StatusPill";

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

function statusMeta(status: ApprovalStatus): { label: string; icon: LucideIcon; tone: PillTone } {
  switch (status) {
    case "APPROVED":
      return { label: "Approved", icon: Check, tone: "success" };
    case "CHANGES_REQUESTED":
      return { label: "Changes requested", icon: MessageSquareWarning, tone: "warning" };
    default:
      return { label: "Pending review", icon: Clock, tone: "neutral" };
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
            <StatusPill tone={meta.tone} icon={Icon}>
              {meta.label}
              {dateLabel && <span className="font-normal opacity-75">· {dateLabel}</span>}
            </StatusPill>
          )}

          {viewInfo && (
            <StatusPill tone="neutral" icon={Eye}>
              Viewed{viewedLabel ? ` ${viewedLabel}` : ""}
              {viewInfo.viewCount > 1 && (
                <span className="font-normal opacity-75">· {viewInfo.viewCount}x</span>
              )}
            </StatusPill>
          )}
        </div>
      </div>
    );
  }

  if (!canAct) return null;

  return (
    <div className="shrink-0 border-b border-[var(--border-1)] bg-[var(--surface-0)]/60 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone={meta.tone} icon={Icon}>
          {meta.label}
          {dateLabel && <span className="font-normal opacity-75">· {dateLabel}</span>}
        </StatusPill>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onRequestChanges} disabled={isSubmitting}>
            Request changes
          </Button>

          <Button
            variant="success"
            size="sm"
            onClick={onApprove}
            disabled={isSubmitting || status === "APPROVED"}
          >
            <Check className="h-3.5 w-3.5" />
            {status === "APPROVED" ? "Approved" : "Approve"}
          </Button>
        </div>
      </div>
    </div>
  );
}
