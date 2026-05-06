import { inngest } from "../client";

export const onboardingSend = inngest.createFunction(
  { id: "subscriber/onboarding-send", retries: 3 },
  { event: "subscriber/confirmed" },
  async ({ event, step }) => {
    const subscriberId = event.data.subscriberId as string;

    const data = await step.run("load-subscriber", async () => {
      const { db } = await import("@/lib/db");
      const sub = await db.subscriber.findUnique({ where: { id: subscriberId } });
      if (!sub) return null;

      let deputy = null;
      if (sub.deputySlug) {
        deputy = await db.politician.findUnique({
          where: { slug: sub.deputySlug },
          select: {
            slug: true,
            fullName: true,
            blobPhotoUrl: true,
            photoUrl: true,
            currentParty: { select: { shortName: true, name: true } },
          },
        });
      }
      return {
        subscriber: {
          email: sub.email,
          unsubscribeToken: sub.unsubscribeToken,
        },
        deputy,
      };
    });

    if (!data) return { status: "skipped", reason: "subscriber-not-found" };

    const html = await step.run("render", async () => {
      const { renderOnboardingHtml } = await import("@/lib/email/render-onboarding");
      return renderOnboardingHtml({
        deputyName: data.deputy?.fullName ?? null,
        deputyParty: data.deputy?.currentParty?.shortName ?? null,
        deputyProfileUrl: data.deputy
          ? `https://poligraph.fr/politiques/${data.deputy.slug}`
          : null,
        unsubscribeUrl: `https://poligraph.fr/api/newsletter/unsubscribe?token=${data.subscriber.unsubscribeToken}`,
      });
    });

    await step.run("send-via-mailjet", async () => {
      const { sendTransactional } = await import("@/lib/email/mailjet");
      await sendTransactional({
        to: data.subscriber.email,
        subject: data.deputy
          ? `Bienvenue sur Poligraph, voici ton député ${data.deputy.fullName}`
          : "Bienvenue sur Poligraph",
        html,
      });
    });

    return { status: "sent", subscriberId };
  }
);
