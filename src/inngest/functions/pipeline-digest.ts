import { inngest } from "../client";

export const pipelineDigest = inngest.createFunction(
  {
    id: "pipeline/health-digest",
    retries: 2,
    concurrency: { limit: 1, key: '"pipeline-digest"' },
  },
  { cron: "0 8 * * *" }, // Daily 8:00 UTC = 9h/10h Paris
  async ({ step }) => {
    // Guard: check env var
    const adminEmail = await step.run("check-config", async () => {
      return process.env.PIPELINE_DIGEST_EMAIL || null;
    });
    if (!adminEmail) {
      return { status: "skipped", reason: "PIPELINE_DIGEST_EMAIL not configured" };
    }

    // Step 1: Compute pipeline health
    const healthData = await step.run("compute-health", async () => {
      const { getPipelineHealthAll } = await import("@/lib/data/pipelines");
      const health = await getPipelineHealthAll();
      return health.map((h) => ({
        pipelineId: h.pipeline.id,
        pipelineName: h.pipeline.name,
        status: h.status,
        hoursSinceLastRun: h.hoursSinceLastRun,
        lastError: h.lastError,
      }));
    });

    // Step 2: Check if digest should be sent
    const digestResult = await step.run("build-digest", async () => {
      const { shouldSendDigest, buildPipelineDigestText } =
        await import("@/lib/email/pipeline-digest");
      const input = { pipelines: healthData, now: new Date() };
      const shouldSend = shouldSendDigest(input);
      const digest = buildPipelineDigestText(input);
      return { shouldSend, ...digest };
    });

    if (!digestResult.shouldSend) {
      return {
        status: "skipped",
        reason: "All pipelines healthy",
        total: healthData.length,
      };
    }

    // Step 3: Send email via Mailjet transactional API
    await step.run("send-email", async () => {
      const Mailjet = (await import("node-mailjet")).default;
      const mailjet = new Mailjet({
        apiKey: process.env.MAILJET_API_KEY!,
        apiSecret: process.env.MAILJET_SECRET_KEY!,
      });

      await mailjet.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: process.env.MAILJET_SENDER_EMAIL || "newsletter@poligraph.fr",
              Name: "Poligraph Pipelines",
            },
            To: [{ Email: adminEmail }],
            Subject: digestResult.subject,
            TextPart: digestResult.text,
          },
        ],
      });
    });

    return {
      status: "sent",
      subject: digestResult.subject,
      recipient: adminEmail,
    };
  }
);
