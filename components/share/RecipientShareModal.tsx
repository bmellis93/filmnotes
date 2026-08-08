"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  canEmail?: boolean;
  canSms?: boolean;
};

type SendResultRow = {
  contactId: string;
  contactName: string;
  ok: boolean;
  share?: any;
  send?: any;
  data?: any;
};

type SendResult = {
  results?: SendResultRow[];
  error?: string;
  detail?: string;
};

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

export type CreateShareResult = { ok: true; url: string } | { ok: false; error: string };

export type RecipientShareModalProps = {
  open: boolean;
  onClose: () => void;

  /** e.g. "Send review link" / "Send gallery link" */
  subtitle: string;
  /** e.g. "Video" / "Gallery" — shown as a label in the footer */
  subjectLabel: string;
  /** videoId, gallery name, etc — shown next to subjectLabel */
  subjectValue: string;

  defaultMessage: string;

  /** Disable sending (e.g. gallery has no shareable videos yet) */
  sendDisabledReason?: string | null;

  /**
   * Creates a tokenized share link for one contact. Returning `ok: false`
   * marks that recipient as failed without aborting the rest of the batch.
   */
  createShare: (args: {
    contactId: string;
    allowComments: boolean;
    allowDownload: boolean;
  }) => Promise<CreateShareResult>;
};

export default function RecipientShareModal({
  open,
  onClose,
  subtitle,
  subjectLabel,
  subjectValue,
  defaultMessage,
  sendDisabledReason,
  createShare,
}: RecipientShareModalProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact[]>([]);

  const [allowComments, setAllowComments] = useState(true);
  const [allowDownloads, setAllowDownloads] = useState(false);

  // Delivery checkboxes: if none selected, server uses Option A fallback.
  const [sendSms, setSendSms] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  const [customMessage, setCustomMessage] = useState("");

  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSend, setLastSend] = useState<SendResult | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (!open) return;

    setQuery("");
    setContacts([]);
    setSelected([]);
    setAllowComments(true);
    setAllowDownloads(false);
    setSendSms(false);
    setSendEmail(false);
    setCustomMessage("");
    setError(null);
    setLastSend(null);
  }, [open]);

  // Abort any pending searches when modal closes/unmounts
  useEffect(() => {
    if (open) return;
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Contact search
  useEffect(() => {
    if (!open) return;

    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setContacts([]);
      return;
    }

    (async () => {
      try {
        setError(null);
        setIsSearching(true);

        searchAbortRef.current?.abort();
        const controller = new AbortController();
        searchAbortRef.current = controller;

        const res = await fetch("/api/ghl/contacts/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to search contacts");

        setContacts(data.contacts || []);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Search failed");
      } finally {
        setIsSearching(false);
      }
    })();
  }, [debouncedQuery, open]);

  const selectedIds = useMemo(() => new Set(selected.map((c) => c.id)), [selected]);

  function toggleSelect(c: Contact) {
    setLastSend(null);
    setError(null);

    if (selectedIds.has(c.id)) {
      setSelected((prev) => prev.filter((x) => x.id !== c.id));
    } else {
      setSelected((prev) => [...prev, c]);
    }
  }

  async function handleSend() {
    setError(null);
    setLastSend(null);

    if (sendDisabledReason) {
      setError(sendDisabledReason);
      return;
    }

    if (!selected.length) {
      setError("Select at least one contact.");
      return;
    }

    setIsSending(true);
    try {
      const origin = window.location.origin;

      const requestedChannels =
        sendSms || sendEmail
          ? ([
              sendSms ? "SMS" : null,
              sendEmail ? "Email" : null,
            ].filter(Boolean) as string[])
          : undefined; // undefined => server uses Option A fallback

      const results: SendResultRow[] = [];

      for (const c of selected) {
        // If user explicitly chose channels, but contact can't support them, filter per-contact.
        const perContactChannels =
          requestedChannels?.filter((ch) => {
            if (ch === "SMS") return Boolean(c.phone);
            if (ch === "Email") return Boolean(c.email);
            return true;
          }) ?? undefined;

        // 1) Create tokenized share link for this contact
        const created = await createShare({
          contactId: c.id,
          allowComments,
          allowDownload: allowDownloads,
        });

        if (!created.ok) {
          results.push({
            contactId: c.id,
            contactName: c.name,
            ok: false,
            data: { error: created.error },
          });
          continue;
        }

        const tokenUrl = `${origin}${created.url}`;

        // 2) Build message
        const base = (customMessage || `${defaultMessage}\n${tokenUrl}`).trim();

        const message =
          base +
          `\n\nPermissions:\n- Comments: ${allowComments ? "Allowed" : "Disabled"}\n- Downloads: ${
            allowDownloads ? "Allowed" : "Disabled"
          }`;

        // 3) Send into GHL Conversations
        const sendRes = await fetch("/api/ghl/conversations/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: c.id,
            message,
            channels: perContactChannels, // undefined => server fallback
          }),
        });

        const sendData = await sendRes.json();

        results.push({
          contactId: c.id,
          contactName: c.name,
          ok: sendRes.ok,
          share: created,
          send: sendData,
        });
      }

      setLastSend({ results });
    } catch (e: any) {
      setError(e?.message || "Send failed");
    } finally {
      setIsSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        type="button"
      />

      {/* Modal */}
      <div className="absolute left-1/2 top-1/2 w-[min(920px,94vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
            <div>
              <div className="text-xs text-neutral-400">Share</div>
              <div className="text-base font-semibold">{subtitle}</div>
            </div>
            <button
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_360px]">
            {/* Left: contact picker */}
            <div className="p-5">
              <div className="text-sm font-semibold">Recipients</div>
              <div className="mt-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search contacts by name, email, or phone…"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm outline-none placeholder:text-neutral-500 focus:border-neutral-600"
                />
              </div>

              {/* Selected chips */}
              {selected.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleSelect(c)}
                      className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                      title="Remove"
                    >
                      <span className="max-w-[220px] truncate">{c.name}</span>
                      <span className="text-neutral-500">×</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Results */}
              <div className="mt-3 rounded-2xl border border-neutral-800 bg-neutral-900">
                <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                  <div className="text-xs text-neutral-400">
                    {isSearching ? "Searching…" : "Results"}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {debouncedQuery.trim().length < 2 ? "Type 2+ characters" : ""}
                  </div>
                </div>

                <div className="max-h-[320px] overflow-auto p-2">
                  {contacts.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-neutral-500">
                      {debouncedQuery.trim().length < 2
                        ? "Start typing to search your GHL contacts."
                        : "No contacts found."}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {contacts.map((c) => {
                        const isSelected = selectedIds.has(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleSelect(c)}
                            className={[
                              "w-full rounded-xl px-3 py-3 text-left hover:bg-neutral-800",
                              isSelected ? "bg-neutral-800" : "bg-transparent",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-neutral-100">
                                  {c.name}
                                </div>
                                <div className="truncate text-xs text-neutral-400">
                                  {c.email || "—"} • {c.phone || "—"}
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <span
                                  className={[
                                    "rounded-md border px-2 py-1 text-[10px]",
                                    c.phone
                                      ? "border-neutral-700 text-neutral-300"
                                      : "border-neutral-900 text-neutral-600",
                                  ].join(" ")}
                                >
                                  SMS
                                </span>
                                <span
                                  className={[
                                    "rounded-md border px-2 py-1 text-[10px]",
                                    c.email
                                      ? "border-neutral-700 text-neutral-300"
                                      : "border-neutral-900 text-neutral-600",
                                  ].join(" ")}
                                >
                                  Email
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Error / status */}
              {error && (
                <div className="mt-3 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              {lastSend?.results && (
                <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
                  <div className="text-sm font-semibold">Send results</div>
                  <div className="mt-2 space-y-2 text-xs text-neutral-300">
                    {lastSend.results.map((r, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate">{r.contactName}</div>
                          <div className="truncate text-neutral-500">{r.contactId}</div>
                        </div>
                        <div className={r.ok ? "text-green-300" : "text-red-300"}>
                          {r.ok ? "Sent" : "Failed"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: message + options */}
            <div className="border-t border-neutral-800 p-5 md:border-l md:border-t-0">
              <div className="text-sm font-semibold">Message</div>
              <div className="mt-2">
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder={defaultMessage}
                  className="h-40 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                />
                <div className="mt-2 text-xs text-neutral-500">
                  Leave blank to use default message.
                </div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold">Permissions</div>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
                    <span className="text-neutral-200">Allow comments</span>
                    <input
                      type="checkbox"
                      checked={allowComments}
                      onChange={(e) => setAllowComments(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
                    <span className="text-neutral-200">Allow downloads</span>
                    <input
                      type="checkbox"
                      checked={allowDownloads}
                      onChange={(e) => setAllowDownloads(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold">Delivery</div>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
                    <span className="text-neutral-200">Send SMS</span>
                    <input
                      type="checkbox"
                      checked={sendSms}
                      onChange={(e) => setSendSms(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
                    <span className="text-neutral-200">Send Email</span>
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                  <div className="text-xs text-neutral-500">
                    If you leave both unchecked, the server will use Option A:
                    SMS first, then Email if SMS fails.
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="text-xs text-neutral-500">
                  {subjectLabel}: <span className="text-neutral-300">{subjectValue}</span>
                </div>

                <button
                  type="button"
                  disabled={isSending || selected.length === 0 || Boolean(sendDisabledReason)}
                  onClick={handleSend}
                  className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-200 disabled:opacity-60"
                  title={
                    sendDisabledReason ??
                    (selected.length === 0 ? "Select at least one recipient" : "Send")
                  }
                >
                  {isSending ? "Sending…" : "Send"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
                <div className="text-xs text-neutral-400">Review links</div>
                <div className="mt-1 text-sm text-neutral-200">
                  A unique review link will be generated for each recipient when you send.
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  Links are permissioned and can be disabled later.
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-4">
            <div className="text-xs text-neutral-500">Frame.io vibe, Renowned build 😄</div>
            <button
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800"
              onClick={onClose}
              type="button"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
