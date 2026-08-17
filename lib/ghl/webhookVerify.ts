// lib/ghl/webhookVerify.ts
import "server-only";
import crypto from "crypto";

// Fixed, published constant -- identical for every HighLevel marketplace
// app, not a per-app secret. See:
// https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide
const GHL_WEBHOOK_ED25519_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

const publicKey = crypto.createPublicKey(GHL_WEBHOOK_ED25519_PUBLIC_KEY_PEM);

/**
 * Verifies a HighLevel marketplace webhook's X-GHL-Signature header
 * (Ed25519) against the exact raw request body bytes. Throws on missing or
 * invalid signatures -- callers should reject the request (4xx) if this
 * throws, not process the payload.
 */
export function verifyGhlWebhookSignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) {
    throw new Error("Missing X-GHL-Signature header");
  }

  const signature = Buffer.from(signatureHeader, "base64");
  const data = Buffer.from(rawBody, "utf8");

  const valid = crypto.verify(null, data, publicKey, signature);
  if (!valid) {
    throw new Error("Invalid GHL webhook signature");
  }
}
