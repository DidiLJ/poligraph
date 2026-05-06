import { NextRequest, NextResponse } from "next/server";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { db } from "@/lib/db";
import { verifyMailjetSignature } from "@/lib/newsletter/webhook-signature";

interface MailjetEvent {
  event: string;
  email: string;
  time: number;
}

export const POST = withPublicRoute(async (request: NextRequest) => {
  const rawBody = await request.text();

  const secret = process.env.MAILJET_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Newsletter] MAILJET_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const signature = request.headers.get("x-mailjet-signature");
  if (!verifyMailjetSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: MailjetEvent[];
  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const event of events) {
    if (typeof event.email !== "string") continue;
    const subscriber = await db.subscriber.findUnique({
      where: { email: event.email.toLowerCase() },
    });
    if (!subscriber) continue;

    if (event.event === "open") {
      const openedAt =
        typeof event.time === "number" && Number.isFinite(event.time)
          ? new Date(event.time * 1000)
          : new Date();
      await db.subscriber.update({
        where: { id: subscriber.id },
        data: {
          lastOpenedAt: openedAt,
          consecutiveMisses: 0,
        },
      });
    } else if (event.event === "unsub" || event.event === "spam") {
      if (subscriber.status !== "UNSUBSCRIBED") {
        await db.subscriber.update({
          where: { id: subscriber.id },
          data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
        });
      }
    } else if (event.event === "bounce") {
      if (subscriber.status !== "BOUNCED") {
        await db.subscriber.update({
          where: { id: subscriber.id },
          data: { status: "BOUNCED" },
        });
      }
    }
  }

  return NextResponse.json({ success: true });
});
