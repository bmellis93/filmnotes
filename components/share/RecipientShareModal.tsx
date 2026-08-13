"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveTemplateText, resolveTemplateHtml } from "@/lib/ghl/templateMerge";
import TemplateFolderPicker, { type PickedTemplate } from "@/components/owner/TemplateFolderPicker";

type Contact = {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string | null;
  phone: string | null;
  canEmail?: boolean;
  canSms?: boolean;
};

type GhlTemplate =
  | { id: string; type: "sms"; name: string; body: string }
  | { id: string; type: "email"; name: string; subject: string; html: string };

type ChannelResult = { channel: "SMS" | "Email"; ok: boolean; data?: any };

function channelErrorText(cr: ChannelResult): string | null {
  if (cr.ok) return null;
  // Route returns { error, results: [{ channel, error }] } on a failed send,
  // or { error: "Server error", detail } on an unhandled exception.
  const fromResults = cr.data?.results?.[0]?.error;
  return fromResults || cr.data?.detail || cr.data?.error || null;
}

type SendResultRow = {
  contactId: string;
  contactName: string;
  ok: boolean;
  channelResults: ChannelResult[];
  share?: any;
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
    contactName?: string;
    allowComments: boolean;
    allowDownload: boolean;
  }) => Promise<CreateShareResult>;
};

async function sendChannel(args: {
  contactId: string;
  channel: "SMS" | "Email";
  message: string;
  subject?: string;
  html?: string;
}): Promise<ChannelResult> {
  try {
    const res = await fetch("/api/ghl/conversations/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: args.contactId,
        message: args.message,
        subject: args.subject,
        html: args.html,
        channels: [args.channel],
      }),
    });
    const data = await res.json().catch(() => null);
    return { channel: args.channel, ok: res.ok, data };
  } catch (e: any) {
    return { channel: args.channel, ok: false, data: { error: e?.message || String(e) } };
  }
}

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

  // Delivery checkboxes: if none selected, we try SMS then Email client-side.
  const [sendSms, setSendSms] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  const [customMessage, setCustomMessage] = useState("");

  // Templates
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [smsTemplates, setSmsTemplates] = useState<Extract<GhlTemplate, { type: "sms" }>[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<Extract<GhlTemplate, { type: "email" }>[]>([]);

  const [smsTemplateId, setSmsTemplateId] = useState("");
  const [smsTemplateText, setSmsTemplateText] = useState("");

  const [emailTemplateId, setEmailTemplateId] = useState("");
  const [emailSubject, setEmailSubject] = useState("Your video is ready");
  const [emailCustomMessage, setEmailCustomMessage] = useState("");

  // Email Builder (separate system from the classic templates above)
  const [builderPickerOpen, setBuilderPickerOpen] = useState(false);
  const [builderTemplate, setBuilderTemplate] = useState<PickedTemplate | null>(null);
  const [builderTemplateHtml, setBuilderTemplateHtml] = useState<string | null>(null);
  const [isFetchingBuilderContent, setIsFetchingBuilderContent] = useState(false);
  const [builderContentError, setBuilderContentError] = useState<string | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSend, setLastSend] = useState<SendResult | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);

  // Reset + load templates when opening
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

    setSmsTemplateId("");
    setSmsTemplateText("");
    setEmailTemplateId("");
    setEmailSubject("Your video is ready");
    setEmailCustomMessage("");
    setBuilderPickerOpen(false);
    setBuilderTemplate(null);
    setBuilderTemplateHtml(null);
    setBuilderContentError(null);

    (async () => {
      setLoadingTemplates(true);
      setTemplatesError(null);
      try {
        const [templatesRes, defaultsRes] = await Promise.all([
          fetch("/api/ghl/templates", { cache: "no-store" }),
          fetch("/api/owner/settings/templates", { cache: "no-store" }),
        ]);

        const templatesJson = await templatesRes.json().catch(() => null);
        const defaultsJson = await defaultsRes.json().catch(() => null);

        if (!templatesRes.ok || !templatesJson?.ok) {
          throw new Error(templatesJson?.error || "Failed to load templates from GHL");
        }

        const sms: Extract<GhlTemplate, { type: "sms" }>[] = templatesJson.sms ?? [];
        const email: Extract<GhlTemplate, { type: "email" }>[] = templatesJson.email ?? [];
        setSmsTemplates(sms);
        setEmailTemplates(email);

        const defaultSms = defaultsJson?.defaultSmsTemplateId ?? "";
        const defaultEmail = defaultsJson?.defaultEmailTemplateId ?? "";
        const defaultEmailSource = defaultsJson?.defaultEmailTemplateSource ?? "";

        const smsMatch = sms.find((t) => t.id === defaultSms);
        if (smsMatch) {
          setSmsTemplateId(smsMatch.id);
          setSmsTemplateText(smsMatch.body);
        }

        if (defaultEmail && defaultEmailSource === "builder") {
          const previewUrl = defaultsJson?.defaultEmailTemplatePreviewUrl ?? null;
          setBuilderTemplate({
            id: defaultEmail,
            name: defaultsJson?.defaultEmailTemplateName || defaultEmail,
            previewUrl,
          });
          if (previewUrl) void loadBuilderContent(previewUrl);
        } else {
          const emailMatch = email.find((t) => t.id === defaultEmail);
          if (emailMatch) {
            setEmailTemplateId(emailMatch.id);
            setEmailSubject(emailMatch.subject || "Your video is ready");
          }
        }
      } catch (e: any) {
        setTemplatesError(e?.message || "Failed to load templates");
      } finally {
        setLoadingTemplates(false);
      }
    })();
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

  function onSmsTemplateChange(id: string) {
    setSmsTemplateId(id);
    const t = smsTemplates.find((x) => x.id === id);
    setSmsTemplateText(t ? t.body : "");
  }

  function onEmailTemplateChange(id: string) {
    setEmailTemplateId(id);
    const t = emailTemplates.find((x) => x.id === id);
    setEmailSubject(t ? t.subject || "Your video is ready" : "Your video is ready");
    // Classic and Email Builder selections are mutually exclusive.
    clearBuilderTemplate();
  }

  async function loadBuilderContent(previewUrl: string) {
    setIsFetchingBuilderContent(true);
    setBuilderContentError(null);
    try {
      const res = await fetch(`/api/ghl/email-builder-templates/content?url=${encodeURIComponent(previewUrl)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load template content");
      setBuilderTemplateHtml(json.html);
    } catch (e: any) {
      setBuilderContentError(e?.message || "Failed to load template content");
      setBuilderTemplateHtml(null);
    } finally {
      setIsFetchingBuilderContent(false);
    }
  }

  function clearBuilderTemplate() {
    setBuilderTemplate(null);
    setBuilderTemplateHtml(null);
    setBuilderContentError(null);
  }

  function onBuilderTemplateSelected(picked: PickedTemplate) {
    setBuilderPickerOpen(false);
    setBuilderTemplate(picked);
    setBuilderTemplateHtml(null);
    // Classic and Email Builder selections are mutually exclusive.
    setEmailTemplateId("");
    if (picked.previewUrl) void loadBuilderContent(picked.previewUrl);
    else setBuilderContentError("This template has no content to preview.");
  }

  const selectedEmailTemplate = emailTemplates.find((t) => t.id === emailTemplateId) ?? null;
  const effectiveEmailHtml = selectedEmailTemplate?.html ?? builderTemplateHtml ?? null;

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

    if (builderTemplate && isFetchingBuilderContent) {
      setError("Still loading the Email Builder template — try again in a moment.");
      return;
    }

    if (builderTemplate && !builderTemplateHtml) {
      setError("Couldn't load the Email Builder template content. Pick a different template or clear it.");
      return;
    }

    setIsSending(true);
    try {
      const origin = window.location.origin;
      const explicitChannels = sendSms || sendEmail;

      const results: SendResultRow[] = [];

      for (const c of selected) {
        // 1) Create tokenized share link for this contact
        const created = await createShare({
          contactId: c.id,
          contactName: c.name,
          allowComments,
          allowDownload: allowDownloads,
        });

        if (!created.ok) {
          results.push({
            contactId: c.id,
            contactName: c.name,
            ok: false,
            channelResults: [],
          });
          continue;
        }

        const tokenUrl = `${origin}${created.url}`;

        // 2) Build per-channel content
        const smsBody = smsTemplateId
          ? resolveTemplateText(smsTemplateText, { link: tokenUrl })
          : resolveTemplateText((customMessage || defaultMessage).trim(), { link: tokenUrl });

        const emailPayload = effectiveEmailHtml
          ? {
              subject: emailSubject || selectedEmailTemplate?.subject || "Your video is ready",
              html: resolveTemplateHtml(effectiveEmailHtml, { link: tokenUrl }),
              message: resolveTemplateText(
                emailSubject || selectedEmailTemplate?.subject || "Your video is ready",
                { link: tokenUrl }
              ),
            }
          : {
              subject: emailSubject || "Your video is ready",
              html: undefined as string | undefined,
              message: resolveTemplateText(
                (emailCustomMessage || customMessage || defaultMessage).trim(),
                { link: tokenUrl }
              ),
            };

        // 3) Decide which channels to attempt for this contact
        const wantsSms = (explicitChannels ? sendSms : true) && Boolean(c.phone);
        const wantsEmail = (explicitChannels ? sendEmail : true) && Boolean(c.email);

        const channelResults: ChannelResult[] = [];

        if (explicitChannels) {
          // Explicit choice: attempt every requested+capable channel.
          if (wantsSms) channelResults.push(await sendChannel({ contactId: c.id, channel: "SMS", message: smsBody }));
          if (wantsEmail)
            channelResults.push(
              await sendChannel({
                contactId: c.id,
                channel: "Email",
                message: emailPayload.message,
                subject: emailPayload.subject,
                html: emailPayload.html,
              })
            );
        } else {
          // Fallback: try SMS first, then Email if SMS didn't succeed.
          if (wantsSms) {
            const r = await sendChannel({ contactId: c.id, channel: "SMS", message: smsBody });
            channelResults.push(r);
          }
          if (!channelResults.some((r) => r.ok) && wantsEmail) {
            const r = await sendChannel({
              contactId: c.id,
              channel: "Email",
              message: emailPayload.message,
              subject: emailPayload.subject,
              html: emailPayload.html,
            });
            channelResults.push(r);
          }
        }

        const ok = channelResults.length > 0 && channelResults.every((r) => r.ok);

        results.push({
          contactId: c.id,
          contactName: c.name,
          ok,
          channelResults,
          share: created,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        type="button"
      />

      {/* Modal */}
      <div className="relative flex max-h-full w-[min(960px,96vw)] flex-col overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)] shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-1)] px-5 py-4">
            <div>
              <div className="text-xs text-[var(--text-muted)]">Share</div>
              <div className="text-base font-semibold">{subtitle}</div>
            </div>
            <button
              className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto md:grid-cols-[1fr_420px]">
            {/* Left: contact picker */}
            <div className="p-5">
              <div className="text-sm font-semibold">Recipients</div>
              <div className="mt-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search contacts by name, email, or phone…"
                  className="w-full rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm outline-none placeholder:text-neutral-500 focus:border-neutral-600"
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
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                      title="Remove"
                    >
                      <span className="max-w-[220px] truncate">{c.name}</span>
                      <span className="text-neutral-500">×</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Results */}
              <div className="mt-3 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]">
                <div className="flex items-center justify-between border-b border-[var(--border-1)] px-4 py-3">
                  <div className="text-xs text-[var(--text-muted)]">
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
                              "w-full rounded-xl px-3 py-3 text-left hover:bg-[var(--surface-2)]",
                              isSelected ? "bg-[var(--surface-2)]" : "bg-transparent",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[var(--text-1)]">
                                  {c.name}
                                </div>
                                <div className="truncate text-xs text-[var(--text-muted)]">
                                  {c.email || "—"} • {c.phone || "—"}
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <span
                                  className={[
                                    "rounded-md border px-2 py-1 text-[10px]",
                                    c.phone
                                      ? "border-[var(--border-3)] text-[var(--text-3)]"
                                      : "border-[var(--border-2)] text-neutral-600",
                                  ].join(" ")}
                                >
                                  SMS
                                </span>
                                <span
                                  className={[
                                    "rounded-md border px-2 py-1 text-[10px]",
                                    c.email
                                      ? "border-[var(--border-3)] text-[var(--text-3)]"
                                      : "border-[var(--border-2)] text-neutral-600",
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
                <div className="mt-3 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                  {error}
                </div>
              )}

              {lastSend?.results && (
                <div className="mt-3 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3">
                  <div className="text-sm font-semibold">Send results</div>
                  <div className="mt-2 space-y-2 text-xs text-[var(--text-3)]">
                    {lastSend.results.map((r, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate">{r.contactName}</div>
                          {r.channelResults.length > 0 && (
                            <div className="truncate text-neutral-500">
                              {r.channelResults.map((cr) => `${cr.channel}: ${cr.ok ? "sent" : "failed"}`).join(" · ")}
                            </div>
                          )}
                          {r.channelResults.filter((cr) => !cr.ok).map((cr, i) => {
                            const msg = channelErrorText(cr);
                            if (!msg) return null;
                            return (
                              <div
                                key={i}
                                className="mt-0.5 truncate text-red-600 dark:text-red-300"
                                title={msg}
                              >
                                {cr.channel}: {msg}
                              </div>
                            );
                          })}
                        </div>
                        <div className={r.ok ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300"}>
                          {r.ok ? "Sent" : "Failed"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: message + options */}
            <div className="border-t border-[var(--border-1)] p-5 md:border-l md:border-t-0">
              {templatesError && (
                <div className="mb-4 rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                  {templatesError}
                </div>
              )}

              {/* SMS message */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">SMS message</div>
                  <select
                    value={smsTemplateId}
                    onChange={(e) => onSmsTemplateChange(e.target.value)}
                    disabled={loadingTemplates}
                    className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-2)]"
                  >
                    <option value="">Custom message</option>
                    {smsTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2">
                  <textarea
                    value={smsTemplateId ? smsTemplateText : customMessage}
                    onChange={(e) =>
                      smsTemplateId ? setSmsTemplateText(e.target.value) : setCustomMessage(e.target.value)
                    }
                    placeholder={defaultMessage}
                    className="h-24 w-full resize-none rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                  />
                  <div className="mt-1 text-xs text-neutral-500">
                    {smsTemplateId
                      ? "The review link fills in automatically wherever {{review_link}} appears (or gets appended)."
                      : "Leave blank to use default message."}
                  </div>
                </div>
              </div>

              {/* Email message */}
              <div className="mt-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Email message</div>
                  <div className="flex items-center gap-2">
                    <select
                      value={builderTemplate ? "" : emailTemplateId}
                      onChange={(e) => onEmailTemplateChange(e.target.value)}
                      disabled={loadingTemplates}
                      className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-2)]"
                    >
                      <option value="">Custom message</option>
                      {emailTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setBuilderPickerOpen(true)}
                      className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                    >
                      Browse Email Builder…
                    </button>
                  </div>
                </div>

                {builderTemplate && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)]/60 px-3 py-1.5">
                    <span className="truncate text-xs text-[var(--text-2)]">
                      Using Email Builder: <span className="font-semibold">{builderTemplate.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={clearBuilderTemplate}
                      className="shrink-0 text-xs text-neutral-400 underline hover:text-neutral-200"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <div className="mt-2">
                  <input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Subject"
                    className="w-full rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                  />
                </div>

                <div className="mt-2">
                  {isFetchingBuilderContent ? (
                    <div className="flex h-56 w-full items-center justify-center rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] text-sm text-[var(--text-muted)]">
                      Loading template…
                    </div>
                  ) : builderContentError ? (
                    <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                      {builderContentError}
                    </div>
                  ) : effectiveEmailHtml ? (
                    <div className="overflow-hidden rounded-xl border border-[var(--border-1)]">
                      <iframe
                        title="Email template preview"
                        srcDoc={resolveTemplateHtml(effectiveEmailHtml, {
                          link: "#your-review-link",
                        })}
                        sandbox=""
                        className="h-56 w-full bg-white"
                      />
                    </div>
                  ) : (
                    <textarea
                      value={emailCustomMessage}
                      onChange={(e) => setEmailCustomMessage(e.target.value)}
                      placeholder={customMessage || defaultMessage}
                      className="h-24 w-full resize-none rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                    />
                  )}
                  <div className="mt-1 text-xs text-neutral-500">
                    {effectiveEmailHtml
                      ? "Preview only — the review link fills in automatically wherever {{review_link}} appears (or gets appended)."
                      : "Leave blank to reuse the SMS message text."}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold">Permissions</div>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center justify-between rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm">
                    <span className="text-[var(--text-2)]">Allow comments</span>
                    <input
                      type="checkbox"
                      checked={allowComments}
                      onChange={(e) => setAllowComments(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm">
                    <span className="text-[var(--text-2)]">Allow downloads</span>
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
                  <label className="flex items-center justify-between rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm">
                    <span className="text-[var(--text-2)]">Send SMS</span>
                    <input
                      type="checkbox"
                      checked={sendSms}
                      onChange={(e) => setSendSms(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm">
                    <span className="text-[var(--text-2)]">Send Email</span>
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                  <div className="text-xs text-neutral-500">
                    If you leave both unchecked, we'll try SMS first, then Email if SMS fails.
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="text-xs text-neutral-500">
                  {subjectLabel}: <span className="text-[var(--text-3)]">{subjectValue}</span>
                </div>

                <button
                  type="button"
                  disabled={isSending || selected.length === 0 || Boolean(sendDisabledReason)}
                  onClick={handleSend}
                  className="rounded-xl bg-[var(--accent-solid)] px-4 py-3 text-sm font-semibold text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)] disabled:opacity-60"
                  title={
                    sendDisabledReason ??
                    (selected.length === 0 ? "Select at least one recipient" : "Send")
                  }
                >
                  {isSending ? "Sending…" : "Send"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3">
                <div className="text-xs text-[var(--text-muted)]">Review links</div>
                <div className="mt-1 text-sm text-[var(--text-2)]">
                  A unique review link will be generated for each recipient when you send.
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  Links are permissioned and can be disabled later.
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end border-t border-[var(--border-1)] px-5 py-4">
            <button
              className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              onClick={onClose}
              type="button"
            >
              Done
            </button>
          </div>
      </div>

      <TemplateFolderPicker
        open={builderPickerOpen}
        onClose={() => setBuilderPickerOpen(false)}
        onSelect={onBuilderTemplateSelected}
      />
    </div>
  );
}
