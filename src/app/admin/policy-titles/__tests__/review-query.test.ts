import { describe, it, expect, afterAll, beforeAll } from "vitest";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

const PFX = "TEST_RV_";

let db: typeof import("@/lib/db").db;
let loadReview: typeof import("../_data/review-query").loadReview;
let buildInputHashInput: typeof import("@/services/scrutin-policy-title/index").buildInputHashInput;
let computeInputHash: typeof import("@/services/scrutin-policy-title/input-hash").computeInputHash;
let resolveSubstanceSources: typeof import("@/services/scrutin-policy-title/substance-resolver").resolveSubstanceSources;

let scrutinId: string;
let amendmentId: string;

const SUMMARY = "Le sous-amendement supprime une dérogation aux seuils de qualité de l'eau.";

describeIfDb("loadReview (policy-title per-row review)", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ loadReview } = await import("../_data/review-query"));
    ({ buildInputHashInput } = await import("@/services/scrutin-policy-title/index"));
    ({ computeInputHash } = await import("@/services/scrutin-policy-title/input-hash"));
    ({ resolveSubstanceSources } =
      await import("@/services/scrutin-policy-title/substance-resolver"));

    // Clean any leftovers first.
    await db.scrutinAmendment.deleteMany({
      where: { scrutin: { externalId: { startsWith: PFX } } },
    });
    await db.scrutinPolicyTitle.deleteMany({
      where: { scrutin: { externalId: { startsWith: PFX } } },
    });
    await db.amendment.deleteMany({ where: { externalId: { startsWith: PFX } } });
    await db.scrutin.deleteMany({ where: { externalId: { startsWith: PFX } } });

    const amendment = await db.amendment.create({
      data: {
        externalId: `${PFX}AMD`,
        number: "100",
        status: "ADOPTE",
        legislature: 17,
        chamber: "AN",
        summary: SUMMARY,
      },
    });
    amendmentId = amendment.id;

    const scrutin = await db.scrutin.create({
      data: {
        externalId: `${PFX}S`,
        title: "Sous-amendement n° 100 sur la qualité de l'eau",
        votingDate: new Date("2026-03-10T00:00:00Z"),
        legislature: 17,
        chamber: "AN",
        votesFor: 50,
        votesAgainst: 20,
        votesAbstain: 5,
        result: "ADOPTED",
        sourceUrl: "https://www.assemblee-nationale.fr/test",
        amendmentLinks: {
          create: [{ amendmentId: amendment.id, role: "SUB_AMENDMENT", source: "TITLE_REGEX" }],
        },
      },
    });
    scrutinId = scrutin.id;

    // Compute the CORRECT current hash from fresh substance so inputDrift=false.
    const resolved = await resolveSubstanceSources(scrutinId);
    const label = "Sous-amendement n°100";
    const correctHash = computeInputHash(
      buildInputHashInput(
        {
          title: scrutin.title,
          sourceUrl: scrutin.sourceUrl,
          amendmentLinks: [
            { role: "SUB_AMENDMENT", amendment: { id: amendmentId, number: "100" } },
          ],
        },
        label,
        resolved.blocks
      )
    );

    await db.scrutinPolicyTitle.create({
      data: {
        scrutinId,
        officialTitleSnapshot: scrutin.title,
        officialSourceUrl: scrutin.sourceUrl,
        inputHash: correctHash,
        policyTitle: "Supprimer une dérogation aux seuils de qualité de l'eau",
        proceduralLabel: label,
        confidence: "MEDIUM",
        generationSource: "LLM",
        status: "DRAFT",
        qualitySignals: { substanceDepth: "subAmendment", evidenceCoverage: 0.6 },
        evidenceQuotes: [
          {
            sourceType: "subAmendment",
            sourceId: amendmentId,
            field: "Amendment.summary",
            quote: "supprime une dérogation aux seuils de qualité de l'eau",
          },
        ],
        generationWarnings: [],
        currentWarnings: [],
      },
    });
  });

  afterAll(async () => {
    await db.scrutinAmendment.deleteMany({
      where: { scrutin: { externalId: { startsWith: PFX } } },
    });
    await db.scrutinPolicyTitle.deleteMany({
      where: { scrutin: { externalId: { startsWith: PFX } } },
    });
    await db.amendment.deleteMany({ where: { externalId: { startsWith: PFX } } });
    await db.scrutin.deleteMany({ where: { externalId: { startsWith: PFX } } });
  });

  it("returns the row with fresh blocks and no drift when the hash is current", async () => {
    const review = await loadReview(scrutinId);
    expect(review).not.toBeNull();
    if (!review) return;

    expect(review.scrutin.id).toBe(scrutinId);
    expect(review.policy.scrutinId).toBe(scrutinId);
    expect(review.blocks.length).toBeGreaterThan(0);
    expect(Array.isArray(review.currentWarnings)).toBe(true);
    expect(review.inputDrift).toBe(false);
    expect(review.evidenceDrift).toBe(false);
    expect(Array.isArray(review.revisions)).toBe(true);
    expect(review.amendmentLinks.length).toBe(1);
    expect(review.amendmentLinks[0]?.number).toBe("100");
  });

  it("flags inputDrift (and evidenceDrift) when the source summary changes", async () => {
    await db.amendment.update({
      where: { id: amendmentId },
      data: { summary: "Texte totalement différent et sans rapport." },
    });

    const review = await loadReview(scrutinId);
    expect(review).not.toBeNull();
    if (!review) return;

    expect(review.inputDrift).toBe(true);
    expect(review.evidenceDrift).toBe(true);

    // Restore so the first test stays order-independent on reruns.
    await db.amendment.update({ where: { id: amendmentId }, data: { summary: SUMMARY } });
  });

  it("returns null for a scrutin without a policy-title row", async () => {
    const orphan = await db.scrutin.create({
      data: {
        externalId: `${PFX}ORPHAN`,
        title: "Scrutin sans titre public",
        votingDate: new Date("2026-03-11T00:00:00Z"),
        legislature: 17,
        chamber: "AN",
        votesFor: 1,
        votesAgainst: 0,
        votesAbstain: 0,
        result: "ADOPTED",
      },
    });
    const review = await loadReview(orphan.id);
    expect(review).toBeNull();
  });
});
