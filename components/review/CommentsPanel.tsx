"use client";

import { useEffect, useId, useRef } from "react";
import CommentThread, { ThreadedComment } from "./CommentThread";
import { useCommentFilters } from "./useCommentFilters";

type Props = {
  isToken: boolean;
  commentsOpen: boolean;

  comments: ThreadedComment[];
  isLoadingComments: boolean;

  commentError: string | null;

  canAddComment: boolean;

  isOwner?: boolean;
  onToggleResolved?: (commentId: string, resolved: boolean) => void;

  // thread interactions
  replyToId: string | null;
  setReplyToId: React.Dispatch<React.SetStateAction<string | null>>;

  replyBody: string;
  setReplyBody: React.Dispatch<React.SetStateAction<string>>;

  isReplying: boolean;

  onSeek: (ms: number) => void;
  formatTime: (ms: number) => string;

  onReplySubmit: (opts: { parentId: string; timecodeMs: number }) => void;

  onViewAnnotation?: (comment: ThreadedComment) => void;
};

export default function CommentsPanel({
  isToken,
  commentsOpen,
  comments,
  isLoadingComments,
  commentError,
  canAddComment,

  isOwner,
  onToggleResolved,

  replyToId,
  setReplyToId,
  replyBody,
  setReplyBody,
  isReplying,
  onSeek,
  formatTime,
  onReplySubmit,
  onViewAnnotation,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const {
    filters,
    filterOpen,
    setFilterOpen,
    filterKey,
    setFilterKey,
    visibleComments,
  } = useCommentFilters({ isToken, comments });

  // close dropdown on outside click + Escape
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!filterOpen) return;
      const root = wrapRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      setFilterOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!filterOpen) return;
      if (e.key === "Escape") setFilterOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen, setFilterOpen]);

  return (
    <aside
      className="absolute inset-0 z-30 min-h-0 overflow-hidden md:static md:z-auto md:border-l md:border-[var(--border-1)]"
      aria-label="Comments panel"
      aria-hidden={!commentsOpen}
    >
      <div
        className={[
          "h-full bg-[var(--surface-0)]",
          "transition-transform duration-500",
          commentsOpen ? "translate-x-0 ease-out" : "translate-x-full ease-in",
          commentsOpen ? "pointer-events-auto" : "pointer-events-none",
          "will-change-transform",
        ].join(" ")}
      >
        <div className="h-full overflow-auto p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Comments</div>

            <div ref={wrapRef} className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)]"
                aria-label="Filter comments"
                aria-haspopup="menu"
                aria-expanded={filterOpen}
                aria-controls={menuId}
                title="Filter"
              >
                Filter ▾
              </button>

              <div
                id={menuId}
                role="menu"
                aria-label="Comment filters"
                className={[
                  "absolute right-0 mt-2 w-44 rounded-xl border border-[var(--border-1)] bg-[var(--surface-0)] p-2 shadow-xl",
                  "origin-top-right transition duration-150",
                  filterOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95",
                ].join(" ")}
              >
                {filters.map((f) => {
                  const active = filterKey === f.key;

                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        // keep typing strict without `any`
                        setFilterKey(f.key as typeof filterKey);
                        setFilterOpen(false);
                      }}
                      className={[
                        "w-full rounded-lg px-3 py-2 text-left text-xs",
                        active
                          ? "bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]"
                          : "text-[var(--text-2)] hover:bg-[var(--surface-1)]",
                      ].join(" ")}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {commentError && (
              <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
                {commentError}
              </div>
            )}

            <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]">
              <div className="p-3">
                {isLoadingComments ? (
                  <div className="text-sm text-[var(--text-muted)]">Loading comments…</div>
                ) : visibleComments.length === 0 ? (
                  <div className="text-sm text-[var(--text-muted)]">No comments yet.</div>
                ) : (
                  <CommentThread
                    comments={visibleComments}
                    canAddComment={canAddComment}
                    replyToId={replyToId}
                    setReplyToId={setReplyToId}
                    replyBody={replyBody}
                    setReplyBody={setReplyBody}
                    isReplying={isReplying}
                    onSeek={onSeek}
                    formatTime={formatTime}
                    onReplySubmit={onReplySubmit}
                    isOwner={isOwner}
                    onToggleResolved={onToggleResolved}
                    onViewAnnotation={onViewAnnotation}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}