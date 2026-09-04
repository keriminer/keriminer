import crypto from "node:crypto";
import { config } from "./config";

const GRAPH_API_VERSION = "v21.0";

interface InboundTextMessage {
  from: string;
  id: string;
  text: string;
}

/** Extracts inbound text messages from a WhatsApp Cloud API webhook payload. */
export function parseInboundMessages(body: any): InboundTextMessage[] {
  const messages: InboundTextMessage[] = [];

  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const message of change?.value?.messages ?? []) {
        if (message.type === "text" && message.text?.body) {
          messages.push({
            from: message.from,
            id: message.id,
            text: message.text.body,
          });
        }
      }
    }
  }

  return messages;
}

/** Verifies the X-Hub-Signature-256 header Meta sends with each webhook delivery. */
export function isValidSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!config.whatsappAppSecret) return true; // signature check disabled
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", config.whatsappAppSecret)
    .update(rawBody)
    .digest("hex");
  const provided = signatureHeader.replace("sha256=", "");

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.whatsappPhoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsappAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${detail}`);
  }
}

export async function markMessageRead(messageId: string): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.whatsappPhoneNumberId}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsappAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
}
