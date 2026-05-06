import { db } from "@/lib/db";
import { generateToken } from "./tokens";
import type { SubscriberSource } from "@/generated/prisma";

export interface UpsertInput {
  email: string;
  source: SubscriberSource;
  postalCode?: string;
  deputySlug?: string;
  boussoleProfile?: unknown;
  consentedAt: Date;
  ip?: string;
  userAgent?: string;
}

export interface UpsertResult {
  created: boolean;
  reactivated: boolean;
  alreadyPending: boolean;
  alreadyConfirmed: boolean;
  subscriberId: string;
  confirmationToken: string | null;
}

export async function upsertSubscriber(input: UpsertInput): Promise<UpsertResult> {
  const existing = await db.subscriber.findUnique({
    where: { email: input.email },
  });

  if (!existing) {
    const created = await db.subscriber.create({
      data: {
        email: input.email,
        source: input.source,
        status: "PENDING_CONFIRMATION",
        confirmationToken: generateToken(),
        unsubscribeToken: generateToken(),
        deputySlug: input.deputySlug,
        postalCode: input.postalCode,
        boussoleProfile: input.boussoleProfile as never,
        consentedAt: input.consentedAt,
        ipAtConsent: input.ip,
        userAgentAtConsent: input.userAgent,
      },
    });
    return {
      created: true,
      reactivated: false,
      alreadyPending: false,
      alreadyConfirmed: false,
      subscriberId: created.id,
      confirmationToken: created.confirmationToken,
    };
  }

  if (existing.status === "CONFIRMED") {
    return {
      created: false,
      reactivated: false,
      alreadyPending: false,
      alreadyConfirmed: true,
      subscriberId: existing.id,
      confirmationToken: null,
    };
  }

  if (existing.status === "UNSUBSCRIBED" || existing.status === "BOUNCED") {
    const updated = await db.subscriber.update({
      where: { id: existing.id },
      data: {
        status: "PENDING_CONFIRMATION",
        confirmationToken: generateToken(),
        source: input.source,
        deputySlug: input.deputySlug ?? existing.deputySlug,
        postalCode: input.postalCode ?? existing.postalCode,
        boussoleProfile: (input.boussoleProfile ?? existing.boussoleProfile) as never,
        consentedAt: input.consentedAt,
        unsubscribedAt: null,
      },
    });
    return {
      created: false,
      reactivated: true,
      alreadyPending: false,
      alreadyConfirmed: false,
      subscriberId: updated.id,
      confirmationToken: updated.confirmationToken,
    };
  }

  return {
    created: false,
    reactivated: false,
    alreadyPending: true,
    alreadyConfirmed: false,
    subscriberId: existing.id,
    confirmationToken: existing.confirmationToken,
  };
}
