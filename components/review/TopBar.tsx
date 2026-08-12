"use client";

import {
  ChevronLeft,
  Download,
  PanelRightClose,
  PanelRightOpen,
  Columns2,
  Share2,
} from "lucide-react";

type Props = {
  // left
  onBack?: () => void;
  initials?: string; // "BE" for now, later client initials
  projectTitle: string;
  videoTitle: string; // no .mp4
  version: string;
  versions: string[];
  onVersionChange: (next: string) => void;

  // compare
  canCompare?: boolean;
  isComparing?: boolean;
  onToggleCompare?: () => void;
  onSelectCompare?: () => void;

  // right
  canDownload?: boolean;
  onDownload?: () => void;

  canShare?: boolean;
  onShare?: () => void;

  commentsOpen: boolean;
  onToggleComments: () => void;
};

export default function TopBar({
  onBack,
  initials = "BE",
  projectTitle,
  videoTitle,
  version,
  versions,
  onVersionChange,

  canCompare = false,
  isComparing = false,
  onToggleCompare,
  onSelectCompare,

  canDownload = false,
  onDownload,

  canShare = false,
  onShare,

  commentsOpen,
  onToggleComments,
}: Props) {
  return (
    <header className="shrink-0 border-b border-[var(--border-1)] bg-[var(--surface-0)]/80 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-2 px-2 sm:px-4">
        {/* LEFT */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 text-[var(--text-2)] hover:text-[var(--text-1)]"
            aria-label="Back"
            title="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-semibold text-white sm:grid">
            {initials}
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm text-[var(--text-2)]">
              <span className="hidden font-semibold sm:inline">{projectTitle}</span>
              <span className="hidden text-[var(--text-muted)] sm:inline"> / </span>
              <span className="text-[var(--text-2)]">{videoTitle}</span>
            </div>
          </div>

          {/* Version dropdown */}
          <div className="shrink-0">
            <select
              value={version}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "__compare__") {
                  onSelectCompare?.();
                  return;
                }
                onVersionChange(next);
              }}
              className="rounded-lg bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-2)] outline-none ring-1 ring-[var(--border-1)] hover:bg-[var(--surface-2)]"
              aria-label="Version"
              title="Version"
            >
              {versions.map((v, idx) => (
                <option key={v} value={v}>
                  v{idx + 1}
                </option>
              ))}
              {canCompare && onSelectCompare && (
                <option value="__compare__">Side by side…</option>
              )}
            </select>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {canCompare && onToggleCompare && (
            <button
              type="button"
              onClick={onToggleCompare}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold ring-1 sm:px-3",
                isComparing
                  ? "bg-emerald-950/30 text-emerald-700 dark:text-emerald-200 ring-emerald-900/40 hover:bg-emerald-950/45"
                  : "bg-[var(--surface-1)] text-[var(--text-2)] ring-[var(--border-1)] hover:bg-[var(--surface-2)]",
              ].join(" ")}
              title={isComparing ? "Exit compare" : "Compare versions"}
              aria-label={isComparing ? "Exit compare" : "Compare versions"}
            >
              <Columns2 className="h-4 w-4" />
              <span className="hidden sm:inline">Compare</span>
            </button>
          )}

          {canDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--surface-1)] px-2 py-2 text-xs font-semibold text-[var(--text-2)] ring-1 ring-[var(--border-1)] hover:bg-[var(--surface-2)] sm:px-3"
              title="Download"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}

          {canShare && (
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--surface-1)] px-2 py-2 text-xs font-semibold text-[var(--text-2)] ring-1 ring-[var(--border-1)] hover:bg-[var(--surface-2)] sm:px-3"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          {/* Hide comments toggle while comparing (button still renders, but disabled) */}
          <button
            type="button"
            onClick={onToggleComments}
            disabled={isComparing}
            className="text-[var(--text-2)] hover:text-[var(--text-1)] disabled:opacity-40 disabled:hover:text-[var(--text-2)]"
            aria-label={commentsOpen ? "Hide comments" : "Show comments"}
            title={isComparing ? "Comments hidden during compare" : commentsOpen ? "Hide comments" : "Show comments"}
          >
            {commentsOpen ? (
              <PanelRightClose className="h-5 w-5" />
            ) : (
              <PanelRightOpen className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}