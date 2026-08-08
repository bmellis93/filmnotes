// app/api/ghl/conversations/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Channel = "SMS" | "Email";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * ✅ Replace this with YOUR real auth/session.
 * Goal: trusted orgId (GHL locationId) + userId.
 *
 * Common approaches:
 * - Cookie session (signed)
 * - JWT in Authorization header
 * - GHL iframe signed payload → exchange for your session cookie
 */
async function requireOrgSession(req: NextRequest): Promise<{
  orgId: string;
  userId: string;
  role: "ADMIN" | "USER";
}> {
  // Example: Authorization: Bearer <your_jwt>
  // or cookies().get("session") etc.
  // For now we just throw so you don’t accidentally ship an insecure default.
  throw new Error("requireOrgSession not implemented");
}

/** Load org OAuth token from Installation */
async function getInstallation(orgId: string) {
  const inst = await prisma.installation.findUnique({
    where: { orgId },
    select: {
      orgId: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
    },
  });

  if (!inst) throw new Error("No installation found for orgId");
  if (!inst.accessToken) throw new Error("Missing accessToken for org installation");

  return inst;
}

/**
 * Optional refresh flow (recommended).
 * If you don’t have refresh wired yet, you can temporarily return inst.accessToken,
 * but you’ll eventually get 401s when access tokens expire.
 */
async function getValidAccessToken(orgId: string): Promise<string> {
  const inst = await getInstallation(orgId);

  const needsRefresh =
    inst.expiresAt ? inst.expiresAt.getTime() <= Date.now() + 60_000 : false; // 1 min skew

  if (!needsRefresh) return inst.accessToken;

  // If no refresh token, you can’t refresh — force reinstall.
  if (!inst.refreshToken) {
    throw new Error("Access token expired and no refresh token is stored. Reinstall required.");
  }

  // ---- GHL OAuth refresh ----
  // You’ll need your OAuth client creds and token endpoint.
  // GHL’s OAuth base differs by environment; keep it configurable.
  const OAUTH_BASE = mustEnv("GHL_OAUTH_BASE_URL"); // e.g. https://services.leadconnectorhq.com
  const CLIENT_ID = mustEnv("GHL_CLIENT_ID");
  const CLIENT_SECRET = mustEnv("GHL_CLIENT_SECRET");

  const res = await fetch(`${OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: inst.refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to refresh GHL token (${res.status}): ${text}`);
  }

  const data = (await res.json()) as any;

  const newAccess = String(data.access_token || "");
  const newRefresh = data.refresh_token ? String(data.refresh_token) : inst.refreshToken;

  // GHL usually returns expires_in (seconds)
  const expiresIn = Number(data.expires_in || 0);
  const nextExpiresAt =
    expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;

  if (!newAccess) throw new Error("Refresh succeeded but missing access_token");

  await prisma.installation.update({
    where: { orgId },
    data: {
      accessToken: newAccess,
      refreshToken: newRefresh,
      ...(nextExpiresAt ? { expiresAt: nextExpiresAt } : {}),
    },
  });

  return newAccess;
}

function ghHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    Version: "2021-07-28",
  };
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
    headers: ghHeaders(args.accessToken),
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
    headers: ghHeaders(args.accessToken),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const first = data?.conversations?.[0];
  return first?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await requireOrgSession(req);

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

    const accessToken = await getValidAccessToken(orgId);

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