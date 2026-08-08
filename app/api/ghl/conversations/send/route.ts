// app/api/ghl/conversations/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getGhlAccessToken, ghlHeaders } from "@/lib/ghl/client";

export const runtime = "nodejs";

type Channel = "SMS" | "Email";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function sendMessageToGhl(args: {
  baseUrl: string;
  accessToken: string;
  contactId: string;
  type: Channel;
  message: string;
  subject?: string;
  html?: string;
}) {
  const body: any = {
    contactId: args.contactId,
    type: args.type,
    message: args.message,
  };

  if (args.type === "Email") {
    if (args.subject) body.subject = args.subject;
    if (args.html) body.html = args.html;
  }

  const res = await fetch(`${args.baseUrl}/conversations/messages`, {
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

async function findConversationId(args: {
  baseUrl: string;
  accessToken: string;
  orgId: string; // locationId
  contactId: string;
}) {
  const url = new URL(`${args.baseUrl}/conversations/search`);
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

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await requireOwnerContext();

    const GHL_BASE_URL = mustEnv("GHL_API_BASE_URL"); // e.g. https://services.leadconnectorhq.com

    const body = await req.json();

    const contactId = String(body.contactId || "").trim();
    const message = String(body.message || "").trim();

    const subject = body.subject ? String(body.subject) : "Your video is ready";
    const html = body.html ? String(body.html) : undefined;

    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const accessToken = await getGhlAccessToken(orgId);

    let finalChannels: Channel[] =
      Array.isArray(body.channels) && body.channels.length
        ? body.channels
        : ["SMS", "Email"];

    const results: any[] = [];

    for (const ch of finalChannels) {
      try {
        const r = await sendMessageToGhl({
          baseUrl: GHL_BASE_URL,
          accessToken,
          contactId,
          type: ch,
          message,
          subject,
          html,
        });

        results.push({ channel: ch, result: r });

        // Stop after first success if channels weren't explicitly chosen
        if (!body.channels) break;
      } catch (e: any) {
        results.push({ channel: ch, error: e?.message || String(e) });
      }
    }

    const sent = results.filter((r) => r.result).map((r) => r.channel);

    if (!sent.length) {
      return NextResponse.json(
        { error: "Failed to send via any channel", results },
        { status: 422 }
      );
    }

    const conversationId = await findConversationId({
      baseUrl: GHL_BASE_URL,
      accessToken,
      orgId,
      contactId,
    });

    return NextResponse.json({ ok: true, sent, conversationId, results });
  } catch (err: any) {
    console.error("Send conversation message error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}