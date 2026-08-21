"use client";

import ThemeToggle from "@/components/ThemeToggle"; // or wherever you put it
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import TemplateFolderPicker, { type PickedTemplate } from "@/components/owner/TemplateFolderPicker";

type Props = { orgId: string; isReviewerOrg?: boolean; hasGhlConnection?: boolean };

type GhlTemplate = { id: string; name: string };

export default function SettingsScreen({ orgId, isReviewerOrg, hasGhlConnection }: Props) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [team, setTeam] = useState<any[]>([]);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [smsTemplates, setSmsTemplates] = useState<GhlTemplate[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<GhlTemplate[]>([]);
  const [defaultSmsTemplateId, setDefaultSmsTemplateId] = useState<string>("");
  const [defaultEmailTemplateId, setDefaultEmailTemplateId] = useState<string>("");
  const [defaultEmailTemplateSource, setDefaultEmailTemplateSource] = useState<string>("");
  const [defaultEmailTemplateName, setDefaultEmailTemplateName] = useState<string>("");
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [builderPickerOpen, setBuilderPickerOpen] = useState(false);

  const [loadingWebhook, setLoadingWebhook] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDraft, setWebhookDraft] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);

  const [loadingPlan, setLoadingPlan] = useState(true);
  const [plan, setPlan] = useState<string | null>(null);
  const [storageLimitBytes, setStorageLimitBytes] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/owner/storage/usage", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          setPlan(json.plan ?? null);
          setStorageLimitBytes(Number(json.limitBytes ?? 0));
        }
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, []);

  function fmtPlanStorage(bytes: number | null) {
    if (bytes == null) return "—";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1024) return `${(gb / 1024).toFixed(gb % 1024 === 0 ? 0 : 1)} TB`;
    return `${gb >= 10 ? gb.toFixed(0) : gb.toFixed(1)} GB`;
  }

  const PLAN_LABELS: Record<string, string> = {
    STARTER: "Starter",
    STUDIO: "Studio",
    PRO: "Pro",
    CUSTOM: "Custom",
    OWNER: "Owner (unlimited)",
  };

  async function loadTemplates() {
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

      setSmsTemplates(templatesJson.sms ?? []);
      setEmailTemplates(templatesJson.email ?? []);

      if (defaultsRes.ok && defaultsJson?.ok) {
        setDefaultSmsTemplateId(defaultsJson.defaultSmsTemplateId ?? "");
        setDefaultEmailTemplateId(defaultsJson.defaultEmailTemplateId ?? "");
        setDefaultEmailTemplateSource(defaultsJson.defaultEmailTemplateSource ?? "");
        setDefaultEmailTemplateName(defaultsJson.defaultEmailTemplateName ?? "");
      }
    } catch (e: any) {
      setTemplatesError(e?.message || "Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function saveDefaultTemplates(next: {
    defaultSmsTemplateId: string;
    defaultEmailTemplateId: string;
    defaultEmailTemplateSource: string;
    defaultEmailTemplateName: string;
    defaultEmailTemplatePreviewUrl?: string;
  }) {
    setSavingTemplates(true);
    try {
      const res = await fetch("/api/owner/settings/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultSmsTemplateId: next.defaultSmsTemplateId || null,
          defaultEmailTemplateId: next.defaultEmailTemplateId || null,
          defaultEmailTemplateSource: next.defaultEmailTemplateSource || null,
          defaultEmailTemplateName: next.defaultEmailTemplateName || null,
          defaultEmailTemplatePreviewUrl: next.defaultEmailTemplatePreviewUrl || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to save defaults");
      toast({ kind: "success", message: "Default templates saved" });
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Failed to save defaults" });
    } finally {
      setSavingTemplates(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadWebhook() {
    setLoadingWebhook(true);
    try {
      const res = await fetch("/api/owner/settings/notifications", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load webhook");
      setWebhookUrl(json.notificationWebhookUrl ?? "");
      setWebhookDraft(json.notificationWebhookUrl ?? "");
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Failed to load webhook" });
    } finally {
      setLoadingWebhook(false);
    }
  }

  useEffect(() => {
    void loadWebhook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveWebhook() {
    setSavingWebhook(true);
    try {
      const res = await fetch("/api/owner/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationWebhookUrl: webhookDraft.trim() || null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to save webhook");
      setWebhookUrl(json.notificationWebhookUrl ?? "");
      setWebhookDraft(json.notificationWebhookUrl ?? "");
      toast({ kind: "success", message: json.notificationWebhookUrl ? "Webhook saved" : "Webhook cleared" });
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Failed to save webhook" });
    } finally {
      setSavingWebhook(false);
    }
  }

  async function loadTeam() {
    try {
      const res = await fetch("/api/owner/team", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load team");
      setTeam(json.team ?? []);
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Failed to load team" });
    } finally {
      setLoadingTeam(false);
    }
  }

  useEffect(() => {
    void loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function syncFromGhl() {
    setSyncing(true);
    try {
      const res = await fetch("/api/owner/team/sync", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.detail || json?.error || "Sync failed");
      }
      await loadTeam();
      toast({
        kind: "success",
        message: `Synced ${json.synced} team member${json.synced === 1 ? "" : "s"} from GHL`,
      });
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  async function updateMemberRole(memberId: string, role: string) {
    setSavingRoleId(memberId);
    try {
      const res = await fetch(`/api/owner/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to update role");
      await loadTeam();
      toast({ kind: "success", message: "Role updated" });
    } catch (e: any) {
      toast({ kind: "error", message: e?.message || "Failed to update role" });
    } finally {
      setSavingRoleId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold text-[var(--text-1)]">Settings</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Org: {orgId}</p>

      <div className="mt-6 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
        <div className="text-sm font-semibold text-[var(--text-1)]">Plan</div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-[var(--text-3)]">Current plan</div>
          <div className="text-sm font-semibold text-[var(--text-1)]">
            {loadingPlan
              ? "Loading…"
              : `${plan ? (PLAN_LABELS[plan] ?? plan) : "—"} · ${fmtPlanStorage(storageLimitBytes)} storage`}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
        <div className="text-sm font-semibold text-[var(--text-1)]">Appearance</div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-[var(--text-3)]">Theme</div>
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text-1)]">Team & Permissions</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Pulled from GoHighLevel team members.
            </div>
          </div>

          <button
            type="button"
            onClick={syncFromGhl}
            disabled={syncing}
            className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-2)] disabled:opacity-60"
          >
            {syncing ? "Syncing…" : "Sync from GHL"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loadingTeam ? (
            <div className="text-sm text-[var(--text-muted)]">Loading…</div>
          ) : team.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">
              No team members yet. Click "Sync from GHL" to pull your team.
            </div>
          ) : (
            team.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-[var(--text-1)]">{m.name ?? m.email ?? m.ghlUserId}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">{m.email ?? "—"}</div>
                </div>
                <select
                  value={m.role ?? "VIEWER"}
                  onChange={(e) => updateMemberRole(m.id, e.target.value)}
                  disabled={savingRoleId === m.id}
                  className="shrink-0 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-xs font-semibold text-[var(--text-2)] disabled:opacity-60"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="UPLOADER">Uploader</option>
                  <option value="CONTRIBUTOR">Contributor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
        <div>
          <div className="text-sm font-semibold text-[var(--text-1)]">Message Templates</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            Pulled from GoHighLevel. Pick a default template to pre-select when sending review
            links — you can still override it per send.
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {loadingTemplates ? (
            <div className="text-sm text-[var(--text-muted)]">Loading…</div>
          ) : templatesError ? (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {templatesError}
            </div>
          ) : (
            <>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 px-3 py-2">
                <span className="text-sm text-[var(--text-2)]">Default SMS template</span>
                <select
                  value={defaultSmsTemplateId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDefaultSmsTemplateId(next);
                    void saveDefaultTemplates({
                      defaultSmsTemplateId: next,
                      defaultEmailTemplateId,
                      defaultEmailTemplateSource,
                      defaultEmailTemplateName,
                    });
                  }}
                  disabled={savingTemplates}
                  className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-0)] px-2 py-1.5 text-sm text-[var(--text-1)]"
                >
                  <option value="">Custom message</option>
                  {smsTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--text-2)]">Default email template</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {defaultEmailTemplateId
                      ? `${defaultEmailTemplateName || defaultEmailTemplateId}${
                          defaultEmailTemplateSource === "builder" ? " (Email Builder)" : " (Classic)"
                        }`
                      : "Custom message"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={defaultEmailTemplateSource === "classic" ? defaultEmailTemplateId : ""}
                    onChange={(e) => {
                      const next = e.target.value;
                      const match = emailTemplates.find((t) => t.id === next);
                      setDefaultEmailTemplateId(next);
                      setDefaultEmailTemplateSource(next ? "classic" : "");
                      setDefaultEmailTemplateName(match?.name ?? "");
                      void saveDefaultTemplates({
                        defaultSmsTemplateId,
                        defaultEmailTemplateId: next,
                        defaultEmailTemplateSource: next ? "classic" : "",
                        defaultEmailTemplateName: match?.name ?? "",
                      });
                    }}
                    disabled={savingTemplates}
                    className="min-w-[160px] flex-1 rounded-lg border border-[var(--border-1)] bg-[var(--surface-0)] px-2 py-1.5 text-sm text-[var(--text-1)]"
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
                    disabled={savingTemplates}
                    className="shrink-0 rounded-lg border border-[var(--border-1)] bg-[var(--surface-0)] px-3 py-1.5 text-sm text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                  >
                    Browse Email Builder…
                  </button>
                </div>
              </div>

              {smsTemplates.length === 0 && emailTemplates.length === 0 && (
                <div className="text-xs text-[var(--text-muted)]">
                  No templates found in GHL yet. Create some in HighLevel under Marketing → SMS/Email
                  templates, then refresh this page. To have the review link inserted automatically,
                  include <code className="rounded bg-[var(--surface-1)] px-1">{"{{review_link}}"}</code>{" "}
                  somewhere in the template.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
        <div>
          <div className="text-sm font-semibold text-[var(--text-1)]">Notifications</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            We'll POST a JSON payload here whenever a client comments, approves, or requests
            changes — point it at a GHL workflow with an "Inbound Webhook" trigger (use a{" "}
            <span className="text-[var(--text-2)]">Send Internal Notification</span> action to alert
            yourself), or at Zapier/Make/n8n.
          </div>
        </div>

        {loadingWebhook ? (
          <div className="mt-4 text-sm text-[var(--text-muted)]">Loading…</div>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            <input
              value={webhookDraft}
              onChange={(e) => setWebhookDraft(e.target.value)}
              placeholder="https://services.leadconnectorhq.com/hooks/..."
              className="min-w-0 flex-1 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-1)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--border-3)]"
            />
            <button
              type="button"
              onClick={saveWebhook}
              disabled={savingWebhook || webhookDraft === webhookUrl}
              className="shrink-0 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {savingWebhook ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {isReviewerOrg && (
        <div className="mt-6 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-0)]/40 p-4">
          <div className="text-sm font-semibold text-[var(--text-1)]">GHL sandbox</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            Connect a HighLevel sub-account of your own to test message sending, email
            templates, and contacts search against real data. This uses HighLevel's own
            login and consent screen -- FilmNotes never sees your credentials.
          </div>

          <div className="mt-4">
            {hasGhlConnection ? (
              <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--success)]/15 px-3 py-2 text-xs font-medium text-[var(--success)]">
                Connected
              </span>
            ) : (
              <a
                href="/api/auth/reviewer-connect/start"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-2)]"
              >
                Connect a GHL sandbox
              </a>
            )}
          </div>
        </div>
      )}

      <TemplateFolderPicker
        open={builderPickerOpen}
        onClose={() => setBuilderPickerOpen(false)}
        onSelect={(picked: PickedTemplate) => {
          setDefaultEmailTemplateId(picked.id);
          setDefaultEmailTemplateSource("builder");
          setDefaultEmailTemplateName(picked.name);
          setBuilderPickerOpen(false);
          void saveDefaultTemplates({
            defaultSmsTemplateId,
            defaultEmailTemplateId: picked.id,
            defaultEmailTemplateSource: "builder",
            defaultEmailTemplateName: picked.name,
            defaultEmailTemplatePreviewUrl: picked.previewUrl ?? "",
          });
        }}
      />
    </div>
  );
}