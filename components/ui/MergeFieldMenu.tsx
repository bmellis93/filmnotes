"use client";

import { useEffect, useRef, useState } from "react";
import { Braces, Check } from "lucide-react";

export type MergeField = { label: string; token: string };

// GHL's own contact merge fields (resolved server-side on any message sent
// with a contactId -- see lib/ghl/templateMerge.ts's comment, verified
// against https://help.gohighlevel.com/.../list-of-merge-fields) plus our
// own {{review_link}} token, which the same resolver fills in locally.
export const CONTACT_MERGE_FIELDS: MergeField[] = [
  { label: "Full name", token: "{{contact.name}}" },
  { label: "First name", token: "{{contact.first_name}}" },
  { label: "Last name", token: "{{contact.last_name}}" },
  { label: "Email", token: "{{contact.email}}" },
  { label: "Phone", token: "{{contact.phone}}" },
  { label: "Company name", token: "{{contact.company_name}}" },
];

export const REVIEW_LINK_MERGE_FIELD: MergeField = { label: "Review link", token: "{{review_link}}" };

/**
 * Small "Insert merge field" dropdown for a specific text input/textarea --
 * inserts the chosen token at the current cursor position (falling back to
 * the end if nothing's focused yet) rather than just appending.
 */
export default function MergeFieldMenu({
  targetRef,
  value,
  onChange,
  fields = [...CONTACT_MERGE_FIELDS, REVIEW_LINK_MERGE_FIELD],
  label = "Insert merge field",
}: {
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (next: string) => void;
  fields?: MergeField[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function onDocMouseDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) close();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function insert(token: string) {
    const el = targetRef.current;

    if (!el) {
      onChange(value + token);
      close();
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    close();

    // Restore focus + cursor position after the insert, once the value
    // prop above has actually reached the input (next tick).
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Braces className="h-3.5 w-3.5" />
        {label}
      </button>

      <div
        role="menu"
        aria-label="Merge fields"
        className={[
          "absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)] p-2 shadow-xl",
          "origin-top-right transition duration-150 focus:outline-none",
          open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95",
        ].join(" ")}
      >
        <div className="space-y-0.5">
          {fields.map((f) => (
            <button
              key={f.token}
              type="button"
              role="menuitem"
              onClick={() => insert(f.token)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs text-[var(--text-2)] outline-none hover:bg-[var(--surface-1)] focus-visible:bg-[var(--surface-1)]"
            >
              <span>{f.label}</span>
              <span className="text-[var(--text-muted)]">{f.token}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
