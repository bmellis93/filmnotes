"use client";

import React, { useId } from "react";

export type ThreadedComment = {
  id: string;
  timecodeMs: number;
  body: string;
  author: string | null;
  createdAt: string;
  parentId: string | null;
  replies: ThreadedComment[];

  // framework fields (optional for now)
  role?: "OWNER" | "CLIENT";
  status?: "OPEN" | "RESOLVED";
};

type Props = {
  comments: ThreadedComment[];
  canAddComment: boolean;

  isOwner?: boolean;
  onToggleResolved?: (commentId: string, resolved: boolean) => void;

  replyToId: string | null;
  setReplyToId: React.Dispatch<React.SetStateAction<string | null>>;

  replyBody: string;
  setReplyBody: React.Dispatch<React.SetStateAction<string>>;

  isReplying: boolean;

  onSeek: (ms: number) => void;
  formatTime: (ms: number) => string;

  onReplySubmit: (opts: { parentId: string; timecodeMs: number }) => void;
};

function safeDateLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

type CommentNodeProps = {
  c: ThreadedComment;
  depth?: number;
  canAddComment: boolean;
  isOwner?: boolean;
  onToggleResolved?: (commentId: string, resolved: boolean) => void;
  replyToId: string | null;
  setReplyToId: React.Dispatch<React.SetStateAction<string | null>>;
  replyBody: string;
  setReplyBody: React.Dispatch<React.SetStateAction<string>>;
  isReplying: boolean;
  onSeek: (ms: number) => void;
  formatTime: (ms: number) => string;
  onReplySubmit: (opts: { parentId: string; timecodeMs: number }) => void;
};

function CommentNode({
  c,
  depth = 0,
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
}: CommentNodeProps) {
  const replyPanelId = useId();
  const isOpen = replyToId === c.id;

  const status = c.status ?? "OPEN";
  const isResolved = status === "RESOLVED";

  const canReply = canAddComment && !isReplying;
  const canSendReply = canReply && replyBody.trim().length > 0;

  const showOwnerControls = Boolean(isOwner && onToggleResolved);

  return (
    <div className="space-y-2" style={{ marginLeft: depth ? depth * 16 : 0 }}>
      <div
        className={[
          "rounded-xl border p-3",
          isResolved
            ? "border-neutral-900 bg-neutral-950/20"
            : "border-neutral-800 bg-neutral-950/40",
        ].join(" ")}
      >
        {/* Only show timestamp + red bubble for top-level comments */}
        {depth === 0 && (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onSeek(c.timecodeMs)}
              title="Jump to timecode"
              className="rounded-full bg-red-950/60 px-2.5 py-0.5 text-xs font-semibold text-red-200 ring-1 ring-red-900/50 hover:bg-red-900/70 hover:text-red-100 transition"
            >
              {formatTime(c.timecodeMs)}
            </button>

            <div className="flex items-center gap-2">
              {isResolved && (
                <span className="rounded-full border border-neutral-800 bg-neutral-900/40 px-2 py-0.5 text-[11px] font-semibold text-neutral-200">
                  Resolved
                </span>
              )}
              <div className="text-xs text-neutral-500">{safeDateLabel(c.createdAt)}</div>
            </div>
          </div>
        )}

        <div
          className={[
            "mt-1 text-sm leading-relaxed",
            isResolved ? "text-neutral-300" : "text-neutral-100",
          ].join(" ")}
        >
          {c.body}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setReplyToId((prev) => (prev === c.id ? null : c.id));
              setReplyBody("");
            }}
            disabled={!canAddComment}
            className="text-xs font-semibold text-neutral-300 hover:text-white disabled:opacity-50"
            aria-expanded={isOpen}
            aria-controls={replyPanelId}
          >
            Reply
          </button>

          {showOwnerControls ? (
            <button
              type="button"
              onClick={() => onToggleResolved?.(c.id, !isResolved)}
              className={[
                "text-xs px-2 py-1 rounded-md border font-semibold transition",
                isResolved
                  ? "border-neutral-800 bg-neutral-900/40 text-neutral-200 hover:bg-neutral-900"
                  : "border-emerald-900/40 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-950/50",
              ].join(" ")}
              title={isResolved ? "Mark as open" : "Mark as resolved"}
            >
              {isResolved ? "Reopen" : "Resolve"}
            </button>
          ) : null}
        </div>

        {isOpen && (
          <div className="mt-2" id={replyPanelId}>
            <textarea
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-700"
              placeholder="Write a reply…"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={2}
              disabled={!canAddComment || isReplying}
            />

            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReplyToId(null);
                  setReplyBody("");
                }}
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  onReplySubmit({
                    parentId: c.id,
                    timecodeMs: c.timecodeMs,
                  })
                }
                disabled={!canSendReply}
                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-200 disabled:opacity-50"
                aria-label="Send reply"
              >
                {isReplying ? "Sending…" : "Reply"}
              </button>
            </div>
          </div>
        )}
      </div>

      {c.replies?.length > 0 && (
        <div className="space-y-2">
          {c.replies.map((r) => (
            <CommentNode
              key={r.id}
              c={r}
              depth={depth + 1}
              canAddComment={canAddComment}
              isOwner={isOwner}
              onToggleResolved={onToggleResolved}
              replyToId={replyToId}
              setReplyToId={setReplyToId}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              isReplying={isReplying}
              onSeek={onSeek}
              formatTime={formatTime}
              onReplySubmit={onReplySubmit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({
  comments,
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
}: Props) {
  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <CommentNode
          key={c.id}
          c={c}
          canAddComment={canAddComment}
          isOwner={isOwner}
          onToggleResolved={onToggleResolved}
          replyToId={replyToId}
          setReplyToId={setReplyToId}
          replyBody={replyBody}
          setReplyBody={setReplyBody}
          isReplying={isReplying}
          onSeek={onSeek}
          formatTime={formatTime}
          onReplySubmit={onReplySubmit}
        />
      ))}
    </div>
  );
}
