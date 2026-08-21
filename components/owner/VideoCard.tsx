"use client";

import Link from "next/link";
import { Clock, MessageSquare, Layers } from "lucide-react";
import StatusPill, { type PillTone } from "@/components/ui/StatusPill";

export type OwnerVideoStatus = "READY" | "UPLOADING" | "PROCESSING" | "FAILED";

export type OwnerVideo = {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string | null;
  createdAt: string;
  status: OwnerVideoStatus;

  // future fields
  commentCount?: number;
  versionCount?: number; // if stacked
};

type Props = {
  galleryId: string;
  video: OwnerVideo;
};

function statusLabel(status: OwnerVideoStatus) {
  switch (status) {
    case "READY":
      return "Ready";
    case "UPLOADING":
      return "Uploading";
    case "PROCESSING":
      return "Processing";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

function statusTone(status: OwnerVideoStatus): PillTone {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "danger";
    case "PROCESSING":
    case "UPLOADING":
    default:
      return "neutral";
  }
}

function safeDateLabel(iso: string) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleDateString();
}

export default function VideoCard({ galleryId, video }: Props) {
  const href = `/owner/galleries/${galleryId}/videos/${video.id}`;

  const createdLabel = safeDateLabel(video.createdAt);
  const commentCount = Math.max(0, video.commentCount ?? 0);
  const versionCount = Math.max(1, video.versionCount ?? 1);
  const label = statusLabel(video.status);

  return (
    <Link
      href={href}
      aria-label={`Open ${video.title}`}
      className={[
        "group block overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--surface-0)]/40 transition",
        "hover:bg-[var(--surface-1)]/25 hover:border-[var(--border-3)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)]",
      ].join(" ")}
    >
      {/* media */}
      <div className="relative aspect-video bg-[var(--surface-1)]/60">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt=""
            className={[
              "h-full w-full object-cover",
              "transition-transform duration-200 ease-out",
              "group-hover:scale-[1.02]",
            ].join(" ")}
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[var(--text-muted)] text-sm">
            Thumbnail
          </div>
        )}

        {/* subtle hover overlay */}
        <div
          className={[
            "pointer-events-none absolute inset-0",
            "opacity-0 transition-opacity duration-200",
            "group-hover:opacity-100",
            "bg-gradient-to-t from-black/35 via-black/0 to-black/0",
          ].join(" ")}
        />

        {/* status pill */}
        <div className="absolute left-3 top-3">
          <StatusPill tone={statusTone(video.status)} className="px-2 py-0.5 backdrop-blur">
            {label}
          </StatusPill>
        </div>
      </div>

      {/* content */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--text-1)]">
              {video.title}
            </div>

            {video.description ? (
              <div className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">
                {video.description}
              </div>
            ) : (
              <div className="mt-1 text-xs text-[var(--text-muted)]">No description</div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular-nums">{createdLabel}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1" title="Comments">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="tabular-nums">{commentCount}</span>
            </span>

            <span className="inline-flex items-center gap-1" title="Versions">
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="tabular-nums">{versionCount}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}