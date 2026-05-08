import { timingSafeEqual } from "crypto";

const BASIC_PREFIX = "Basic ";

/**
 * Verify the HTTP Basic Auth header sent by the Mailjet webhook against the
 * configured shared secret. The webhook URL stored in Mailjet UI is shaped as:
 *
 *   https://mailjet:<MAILJET_WEBHOOK_SECRET>@poligraph.fr/api/newsletter/webhook
 *
 * Mailjet extracts the userinfo from the URL and sends:
 *
 *   Authorization: Basic base64("mailjet:<secret>")
 *
 * The username is ignored — only the password (= our secret) is compared.
 * Comparison is constant-time to prevent timing attacks.
 *
 * Mailjet does not natively sign webhook payloads (no HMAC support in the
 * Sinch UI as of 2026-05), so Basic Auth in the URL is the cleanest available
 * authentication method. The Authorization header is not echoed in HTTP access
 * logs by default, unlike a query-string token.
 */
export function verifyMailjetBasicAuth(authHeader: string | null, secret: string): boolean {
  if (!authHeader || !secret) return false;
  if (!authHeader.startsWith(BASIC_PREFIX)) return false;

  const encoded = authHeader.slice(BASIC_PREFIX.length).trim();
  if (encoded.length === 0) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return false;
  }

  const colonIdx = decoded.indexOf(":");
  if (colonIdx < 0) return false;
  const provided = decoded.slice(colonIdx + 1);

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
