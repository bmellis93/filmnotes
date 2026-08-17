"use client";

import React, { useId } from "react";
import { Pencil } from "lucide-react";
import type { Annotation } from "@/lib/annotations/types";
import Button from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";

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
  isApprovalNote?: boolean;
  annotation?: Annotation | null;
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

  onViewAnnotation?: (comment: ThreadedComment) => void;
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
  onViewAnnotation?: (comment: ThreadedComment) => void;
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
  onViewAnnotation,
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
            ? "border-[var(--border-2)] bg-[var(--surface-0)]/20"
            : "border-[var(--border-1)] bg-[var(--surface-0)]/40",
        ].join(" ")}
      >
        {/* Only show timestamp + red bubble for top-level comments */}
        {depth === 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {c.isApprovalNote ? (
                <StatusPill tone="warning">Changes requested</StatusPill>
              ) : (
                <button
                  type="button"
                  onClick={() => onSeek(c.timecodeMs)}
                  title="Jump to timecode"
                  className="font-timecode rounded-full border border-[var(--warning)]/30 bg-[var(--warning)]/15 px-2.5 py-0.5 text-xs font-semibold text-[var(--warning)] hover:bg-[var(--warning)]/25 transition"
                >
                  {formatTime(c.timecodeMs)}
                </button>
              )}

              {c.annotation && (
                <button
                  type="button"
                  onClick={() => onViewAnnotation?.(c)}
                  title="Show drawing"
                  aria-label="Show drawing"
                  className="rounded-full bg-[var(--surface-1)] p-1 text-[var(--text-2)] ring-1 ring-[var(--border-1)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isResolved && (
                <StatusPill tone="success" className="px-2 py-0.5 text-[11px]">
                  Resolved
                </StatusPill>
              )}
              <div className="text-xs text-[var(--text-muted)]">{safeDateLabel(c.createdAt)}</div>
            </div>
          </div>
        )}

        <div
          className={[
            "mt-1 text-sm leading-relaxed",
            isResolved ? "text-[var(--text-2)]" : "text-[var(--text-1)]",
          ].join(" ")}
        >
          {c.body}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setReplyToId((prev) => (prev === c.id ? null : c.id));
              setReplyBody("");
            }}
            disabled={!canAddComment}
            aria-expanded={isOpen}
            aria-controls={replyPanelId}
          >
            Reply
          </Button>

          {showOwnerControls ? (
            <Button
              variant={isResolved ? "secondary" : "success"}
              size="sm"
              onClick={() => onToggleResolved?.(c.id, !isResolved)}
              title={isResolved ? "Mark as open" : "Mark as resolved"}
            >
              {isResolved ? "Reopen" : "Resolve"}
            </Button>
          ) : null}
        </div>

        {isOpen && (
          <div className="mt-2" id={replyPanelId}>
            <textarea
              className="w-full rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-2 text-sm text-[var(--text-1)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--border-3)]"
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
                className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)]"
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
                className="rounded-lg bg-[var(--accent-solid)] px-3 py-2 text-xs font-semibold text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)] disabled:opacity-50"
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
              onViewAnnotation={onViewAnnotation}
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
  onViewAnnotation,
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
          onViewAnnotation={onViewAnnotation}
        />
      ))}
    </div>
  );
}
