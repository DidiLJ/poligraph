import { inngest } from "../client";

export const sendNewsletter = inngest.createFunction(
  {
    id: "newsletter/weekly-send",
    retries: 2,
    concurrency: { limit: 1, key: '"newsletter"' },
  },
  { cron: "0 7 * * 1" }, // Monday 7:00 UTC = 8h/9h Paris
  async ({ step }) => {
    // Guard: check feature flag
    const enabled = await step.run("check-enabled", async () => {
      return process.env.NEWSLETTER_ENABLED === "true";
    });
    if (!enabled) {
      return { status: "skipped", reason: "NEWSLETTER_ENABLED is not true" };
    }

    // Step 1: Fetch recap data for last week
    const recap = await step.run("fetch-recap", async () => {
      const { getWeeklyRecap, getWeekStart } = await import("@/lib/data/recap");
      const now = new Date();
      const lastMonday = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      const data = await getWeeklyRecap(lastMonday);
      // Serialize dates for Inngest step storage
      return JSON.parse(JSON.stringify(data));
    });

    // Skip if empty week
    if (recap.votes.total === 0 && recap.affairs.total === 0 && recap.factChecks.total === 0) {
      return { status: "skipped", reason: "Empty week" };
    }

    // Step 2: Select politician of the week + save edition
    const politicianData = await step.run("select-politician", async () => {
      const { selectPoliticianOfWeek } = await import("@/lib/email/select-politician");
      const { db } = await import("@/lib/db");
      const { getWeekStart } = await import("@/lib/data/recap");

      const politicianId = await selectPoliticianOfWeek();
      if (!politicianId) return null;

      const now = new Date();
      const weekStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));

      await db.newsletterEdition.upsert({
        where: { weekStart },
        create: { weekStart, politicianId },
        update: { politicianId },
      });

      const politician = await db.politician.findUnique({
        where: { id: politicianId },
        select: {
          slug: true,
          fullName: true,
          photoUrl: true,
          blobPhotoUrl: true,
          currentParty: { select: { shortName: true } },
          mandates: {
            where: { isCurrent: true },
            take: 1,
            select: { title: true },
          },
        },
      });

      if (!politician) return null;

      return {
        slug: politician.slug,
        fullName: politician.fullName,
        photoUrl: politician.blobPhotoUrl || politician.photoUrl,
        partyShortName: politician.currentParty?.shortName ?? null,
        mandateTitle: politician.mandates[0]?.title ?? null,
      };
    });

    // Step 3: Build static content (no AI)
    const content = await step.run("build-content", async () => {
      const { buildStaticEditorial, buildStaticBio } = await import("@/lib/email/static-content");
      const { getWeekStart, getISOWeekNumber } = await import("@/lib/data/recap");

      const now = new Date();
      const weekStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      const weekNum = getISOWeekNumber(weekStart);

      // Rehydrate dates (serialized to ISO strings by Inngest step storage)
      const rehydrated = {
        ...recap,
        weekStart: new Date(recap.weekStart),
        weekEnd: new Date(recap.weekEnd),
        votes: {
          ...recap.votes,
          scrutins: recap.votes.scrutins.map(
            (s: { votingDate: string; [key: string]: unknown }) => ({
              ...s,
              votingDate: new Date(s.votingDate),
            })
          ),
        },
      };

      const editorialIntro = buildStaticEditorial(rehydrated, weekNum);
      const politicianBio = politicianData
        ? buildStaticBio(
            politicianData.fullName,
            politicianData.mandateTitle,
            politicianData.partyShortName
          )
        : "";

      return { editorialIntro, politicianBio, weekNum };
    });

    // Step 4: Render email
    const email = await step.run("render-email", async () => {
      const { renderNewsletterHtml } = await import("@/lib/email/render-recap");
      // Rehydrate dates
      const rehydrated = {
        ...recap,
        weekStart: new Date(recap.weekStart),
        weekEnd: new Date(recap.weekEnd),
        votes: {
          ...recap.votes,
          scrutins: recap.votes.scrutins.map(
            (s: { votingDate: string; [key: string]: unknown }) => ({
              ...s,
              votingDate: new Date(s.votingDate),
            })
          ),
        },
      };
      return renderNewsletterHtml({
        recap: rehydrated,
        editorialIntro: content.editorialIntro,
        politician: politicianData ? { ...politicianData, bio: content.politicianBio } : null,
      });
    });

    // Step 5: Send via Mailjet
    const sendResult = await step.run("send-via-mailjet", async () => {
      const { sendNewsletter: send } = await import("@/lib/email/mailjet");

      const result = await send({
        subject: `La Semaine Poligraph - S${content.weekNum}`,
        htmlContent: email.html,
        textContent: email.text,
      });

      if (result.recipientCount > 0) {
        const { db } = await import("@/lib/db");
        const { getWeekStart } = await import("@/lib/data/recap");
        const now = new Date();
        const weekStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
        await db.newsletterEdition.update({
          where: { weekStart },
          data: { sentAt: new Date(), recipientCount: result.recipientCount },
        });
      }

      return result;
    });

    return {
      status: "sent",
      recipientCount: sendResult.recipientCount,
      politicianOfWeek: politicianData?.fullName ?? null,
    };
  }
);
