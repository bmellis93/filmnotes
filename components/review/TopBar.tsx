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
    <header className="shrink-0 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4">
        {/* LEFT */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-neutral-300 hover:text-white"
            aria-label="Back"
            title="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
            {initials}
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm text-neutral-200">
              <span className="font-semibold">{projectTitle}</span>
              <span className="text-neutral-500"> / </span>
              <span className="text-neutral-300">{videoTitle}</span>
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
              className="rounded-lg bg-neutral-900 px-2 py-1 text-xs text-neutral-200 outline-none ring-1 ring-neutral-800 hover:bg-neutral-800"
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
        <div className="flex items-center gap-3">
          {canCompare && onToggleCompare && (
            <button
              type="button"
              onClick={onToggleCompare}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ring-1",
                isComparing
                  ? "bg-emerald-950/30 text-emerald-200 ring-emerald-900/40 hover:bg-emerald-950/45"
                  : "bg-neutral-900 text-neutral-200 ring-neutral-800 hover:bg-neutral-800",
              ].join(" ")}
              title={isComparing ? "Exit compare" : "Compare versions"}
              aria-label={isComparing ? "Exit compare" : "Compare versions"}
            >
              <Columns2 className="h-4 w-4" />
              Compare
            </button>
          )}

          {canDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-200 ring-1 ring-neutral-800 hover:bg-neutral-800"
              title="Download"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          )}

          {canShare && (
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-200 ring-1 ring-neutral-800 hover:bg-neutral-800"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          )}

          {/* Hide comments toggle while comparing (button still renders, but disabled) */}
          <button
            type="button"
            onClick={onToggleComments}
            disabled={isComparing}
            className="text-neutral-300 hover:text-white disabled:opacity-40 disabled:hover:text-neutral-300"
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