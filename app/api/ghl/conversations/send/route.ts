// app/api/ghl/conversations/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getGhlAccessToken } from "@/lib/ghl/client";
import { sendGhlMessage, findGhlConversationId, type GhlChannel } from "@/lib/ghl/sendMessage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await requireOwnerContext();

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

    const channels: GhlChannel[] | undefined = Array.isArray(body.channels) && body.channels.length
      ? body.channels
      : undefined;

    const { sent, results } = await sendGhlMessage({
      accessToken,
      orgId,
      contactId,
      message,
      subject,
      html,
      channels,
    });

    if (!sent.length) {
      return NextResponse.json(
        { error: "Failed to send via any channel", results },
        { status: 422 }
      );
    }

    const conversationId = await findGhlConversationId({ accessToken, orgId, contactId });

    return NextResponse.json({ ok: true, sent, conversationId, results });
  } catch (err: any) {
    console.error("Send conversation message error:", err?.message || err);
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
