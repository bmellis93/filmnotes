"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  isOwner: boolean;
  note: string;
  onSave?: (next: string) => void;
  isSaving?: boolean;
};

export default function ChangeNoteBar({ isOwner, note, onSave, isSaving }: Props) {
  const [draft, setDraft] = useState(note);

  useEffect(() => {
    setDraft(note);
  }, [note]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === note.trim()) return;
    onSave?.(trimmed);
  }

  if (!isOwner && !note.trim()) return null;

  return (
    <div className="shrink-0 border-b border-neutral-800 bg-neutral-950/60 px-4 py-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden="true" />

        {isOwner ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            disabled={isSaving}
            placeholder="What changed in this version? (shown to the client)"
            className="w-full min-w-0 bg-transparent text-xs text-neutral-300 placeholder-neutral-600 outline-none disabled:opacity-60"
          />
        ) : (
          <div className="min-w-0 truncate text-xs text-neutral-300">
            <span className="font-semibold text-neutral-200">What changed: </span>
            {note}
          </div>
        )}
      </div>
    </div>
  );
}
