import "server-only";
import { ghlHeaders } from "@/lib/ghl/client";

export type GhlChannel = "SMS" | "Email";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// GHL's conversations/messages endpoint rejects Email sends that have no
// `html` body with a 422 ("no message or attachments") -- unlike SMS, it
// doesn't fall back to the plain `message` field. Every Email send needs an
// html body, so plain-text-only callers get one derived from their message.
function plainTextToHtml(message: string) {
  return `<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;
}

export async function sendMessageToGhl(args: {
  accessToken: string;
  contactId: string;
  type: GhlChannel;
  message: string;
  subject?: string;
  html?: string;
}) {
  const baseUrl = mustEnv("GHL_API_BASE_URL");

  const body: any = {
    contactId: args.contactId,
    type: args.type,
    message: args.message,
  };

  if (args.type === "Email") {
    if (args.subject) body.subject = args.subject;
    body.html = args.html || plainTextToHtml(args.message);
  }

  const res = await fetch(`${baseUrl}/conversations/messages`, {
    method: "POST",
    headers: ghlHeaders(args.accessToken),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to send ${args.type} (${res.status}): ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function findGhlConversationId(args: {
  accessToken: string;
  orgId: string; // locationId
  contactId: string;
}): Promise<string | null> {
  const baseUrl = mustEnv("GHL_API_BASE_URL");

  const url = new URL(`${baseUrl}/conversations/search`);
  url.searchParams.set("locationId", args.orgId);
  url.searchParams.set("contactId", args.contactId);
  url.searchParams.set("limit", "1");
  url.searchParams.set("sort", "desc");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: ghlHeaders(args.accessToken),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const first = data?.conversations?.[0];
  return first?.id ?? null;
}

/**
 * Sends via SMS first, falling back to Email if it fails (or vice versa if
 * explicitly requested) -- used anywhere we need to reach a contact without
 * a browser-side caller choosing channels (e.g. the unopened-link nudge).
 */
export async function sendGhlMessage(args: {
  accessToken: string;
  orgId: string;
  contactId: string;
  message: string;
  subject?: string;
  html?: string;
  channels?: GhlChannel[];
}): Promise<{ sent: GhlChannel[]; results: any[] }> {
  const finalChannels: GhlChannel[] =
    args.channels && args.channels.length ? args.channels : ["SMS", "Email"];

  const results: any[] = [];

  for (const ch of finalChannels) {
    try {
      const r = await sendMessageToGhl({
        accessToken: args.accessToken,
        contactId: args.contactId,
        type: ch,
        message: args.message,
        subject: args.subject,
        html: args.html,
      });
      results.push({ channel: ch, result: r });
      if (!args.channels) break; // fallback mode: stop after first success
    } catch (e: any) {
      results.push({ channel: ch, error: e?.message || String(e) });
    }
  }

  const sent = results.filter((r) => r.result).map((r) => r.channel);
  return { sent, results };
}
