import { describe, it, expect, afterAll, beforeAll } from "vitest";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

const PFX = "TEST_Q_";

let db: typeof import("@/lib/db").db;
let queryQueue: typeof import("../_data/queue-query").queryQueue;

describeIfDb("queryQueue (policy-titles moderation queue)", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ queryQueue } = await import("../_data/queue-query"));

    // Clean any leftovers first.
    await db.scrutinAmendment.deleteMany({
      where: { scrutin: { externalId: { startsWith: PFX } } },
    });
    await db.scrutinPolicyTitle.deleteMany({
      where: { scrutin: { externalId: { startsWith: PFX } } },
    });
    await db.amendment.deleteMany({ where: { externalId: { startsWith: PFX } } });
    await db.scrutin.deleteMany({ where: { externalId: { startsWith: PFX } } });
    await db.legislativeDossier.deleteMany({ where: { externalId: `${PFX}DLR` } });

    const dossier = await db.legislativeDossier.create({
      data: {
        externalId: `${PFX}DLR`,
        slug: `${PFX}dossier`,
        title: "Test dossier qualité de l'eau",
        status: "EN_COURS",
      },
    });

    const baseScrutin = {
      legislature: 17,
      chamber: "AN" as const,
      votesFor: 1,
      votesAgainst: 0,
      votesAbstain: 0,
      result: "ADOPTED" as const,
      votingDate: new Date("2026-01-15T00:00:00Z"),
      dossierLegislatifId: dossier.id,
    };

    // Row 1: DRAFT / HIGH / LLM, clean (no warnings), short title.
    await db.scrutin.create({
      data: {
        ...baseScrutin,
        externalId: `${PFX}S_CLEAN`,
        title: "Amendement seuils de qualité de l'eau",
        votingDate: new Date("2026-03-10T00:00:00Z"),
        policyTitle: {
          create: {
            officialTitleSnapshot: "l'amendement n° 100 sur les seuils de qualité de l'eau",
            inputHash: `${PFX}h1`,
            policyTitle: "Renforcer les seuils de qualité de l'eau",
            proceduralLabel: "Amendement n° 100",
            confidence: "HIGH",
            generationSource: "LLM",
            status: "DRAFT",
            qualitySignals: { substanceDepth: "amendment", evidenceCoverage: 0.8 },
            evidenceQuotes: [{ quote: "seuils de qualité de l'eau" }, { quote: "dérogation" }],
            generationWarnings: [],
            currentWarnings: [],
          },
        },
      },
    });

    // Row 2: NEEDS_REVIEW / MEDIUM with a currentWarnings warn.
    await db.scrutin.create({
      data: {
        ...baseScrutin,
        externalId: `${PFX}S_WARN`,
        title: "Amendement long sur la fiscalité agricole et les exonérations diverses",
        votingDate: new Date("2026-03-09T00:00:00Z"),
        policyTitle: {
          create: {
            officialTitleSnapshot: "l'amendement n° 200 relatif à la fiscalité agricole",
            inputHash: `${PFX}h2`,
            policyTitle:
              "Étendre les exonérations fiscales agricoles aux exploitations de petite taille situées en zone de montagne",
            proceduralLabel: "Amendement n° 200",
            confidence: "MEDIUM",
            generationSource: "LLM",
            status: "NEEDS_REVIEW",
            qualitySignals: { substanceDepth: "amendment", evidenceCoverage: 0.4 },
            evidenceQuotes: [{ quote: "exonération" }],
            generationWarnings: [{ code: "LENGTH", severity: "warn", message: "Titre long" }],
            currentWarnings: [{ code: "LENGTH", severity: "warn", message: "Titre long" }],
          },
        },
      },
    });

    // Row 3: FALLBACK, null title, generationWarnings LLM_OUTPUT_INVALID.
    await db.scrutin.create({
      data: {
        ...baseScrutin,
        externalId: `${PFX}S_FALLBACK`,
        title: "Sous-amendement n° 300",
        votingDate: new Date("2026-03-08T00:00:00Z"),
        policyTitle: {
          create: {
            officialTitleSnapshot: "le sous-amendement n° 300",
            inputHash: `${PFX}h3`,
            policyTitle: null,
            proceduralLabel: "Sous-amendement n° 300",
            confidence: "LOW",
            generationSource: "FALLBACK",
            status: "NEEDS_REVIEW",
            qualitySignals: { substanceDepth: null, evidenceCoverage: 0 },
            evidenceQuotes: [],
            generationWarnings: [{ code: "LLM_OUTPUT_INVALID", severity: "warn", message: "x" }],
            currentWarnings: [],
          },
        },
      },
    });

    // Row 4: scrutin linked to a SUB_AMENDMENT amendment; substanceDepth subAmendment + a blocker.
    const subAmd = await db.amendment.create({
      data: {
        externalId: `${PFX}AMD_SUB`,
        number: "400",
        dossierId: dossier.id,
        status: "ADOPTE",
        legislature: 17,
        chamber: "AN",
        content: "<p>Supprime la dérogation.</p>",
      },
    });
    await db.scrutin.create({
      data: {
        ...baseScrutin,
        externalId: `${PFX}S_SUB`,
        title: "Sous-amendement n° 400 dérogation eau",
        votingDate: new Date("2026-03-07T00:00:00Z"),
        amendmentLinks: {
          create: [{ amendmentId: subAmd.id, role: "SUB_AMENDMENT", source: "TITLE_REGEX" }],
        },
        policyTitle: {
          create: {
            officialTitleSnapshot: "le sous-amendement n° 400 sur la dérogation eau",
            inputHash: `${PFX}h4`,
            policyTitle: "Supprimer la dérogation aux seuils de qualité de l'eau",
            proceduralLabel: "Sous-amendement n° 400",
            confidence: "MEDIUM",
            generationSource: "LLM",
            status: "DRAFT",
            qualitySignals: { substanceDepth: "subAmendment", evidenceCoverage: 0.6 },
            evidenceQuotes: [{ quote: "dérogation" }],
            generationWarnings: [
              { code: "SUB_TARGET_NOT_CITED", severity: "blocker", message: "x" },
            ],
            currentWarnings: [{ code: "SUB_TARGET_NOT_CITED", severity: "blocker", message: "x" }],
          },
        },
      },
    });

    // Row 5: REJECTED (excluded by default).
    await db.scrutin.create({
      data: {
        ...baseScrutin,
        externalId: `${PFX}S_REJECTED`,
        title: "Amendement rejeté n° 500",
        votingDate: new Date("2026-03-06T00:00:00Z"),
        policyTitle: {
          create: {
            officialTitleSnapshot: "l'amendement n° 500",
            inputHash: `${PFX}h5`,
            policyTitle: "Un titre rejeté",
            proceduralLabel: "Amendement n° 500",
            confidence: "LOW",
            generationSource: "LLM",
            status: "REJECTED",
            qualitySignals: { substanceDepth: "amendment", evidenceCoverage: 0.2 },
            evidenceQuotes: [],
            generationWarnings: [],
            currentWarnings: [],
          },
        },
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
    await db.legislativeDossier.deleteMany({ where: { externalId: `${PFX}DLR` } });
  });

  // Restrict every assertion to our TEST_Q_ rows via q-scoping where possible.
  // Helper: filter returned rows to ours by externalId prefix.
  const ours = <T extends { scrutinExternalId: string }>(rows: T[]) =>
    rows.filter((r) => r.scrutinExternalId.startsWith(PFX));

  it("default (no status) returns DRAFT+NEEDS_REVIEW, excludes REJECTED", async () => {
    const { rows } = await queryQueue({ take: 500 });
    const mine = ours(rows);
    const ids = mine.map((r) => r.scrutinExternalId);
    expect(ids).toContain(`${PFX}S_CLEAN`);
    expect(ids).toContain(`${PFX}S_WARN`);
    expect(ids).toContain(`${PFX}S_FALLBACK`);
    expect(ids).toContain(`${PFX}S_SUB`);
    expect(ids).not.toContain(`${PFX}S_REJECTED`);
  });

  it("status:['REJECTED'] returns the rejected one", async () => {
    const { rows } = await queryQueue({ status: ["REJECTED"], take: 500 });
    const ids = ours(rows).map((r) => r.scrutinExternalId);
    expect(ids).toContain(`${PFX}S_REJECTED`);
    expect(ids).not.toContain(`${PFX}S_CLEAN`);
  });

  it("confidence:['HIGH'] narrows correctly", async () => {
    const { rows } = await queryQueue({ confidence: ["HIGH"], take: 500 });
    const mine = ours(rows);
    expect(mine.every((r) => r.confidence === "HIGH")).toBe(true);
    expect(mine.map((r) => r.scrutinExternalId)).toContain(`${PFX}S_CLEAN`);
  });

  it("generationSource:['FALLBACK'] returns the null-title row", async () => {
    const { rows } = await queryQueue({ generationSource: ["FALLBACK"], take: 500 });
    const ids = ours(rows).map((r) => r.scrutinExternalId);
    expect(ids).toEqual([`${PFX}S_FALLBACK`]);
  });

  it("warningCode:'LLM_OUTPUT_INVALID' returns the fallback row", async () => {
    const { rows } = await queryQueue({ warningCode: "LLM_OUTPUT_INVALID", take: 500 });
    const ids = ours(rows).map((r) => r.scrutinExternalId);
    expect(ids).toContain(`${PFX}S_FALLBACK`);
    expect(ids).not.toContain(`${PFX}S_CLEAN`);
  });

  it("nullTitle:true returns only null-title rows", async () => {
    const { rows } = await queryQueue({ nullTitle: true, take: 500 });
    const mine = ours(rows);
    expect(mine.every((r) => r.policyTitle === null)).toBe(true);
    expect(mine.map((r) => r.scrutinExternalId)).toContain(`${PFX}S_FALLBACK`);
  });

  it("subAmendmentOnly:true returns only the sub-amendment-linked scrutin's row", async () => {
    const { rows } = await queryQueue({ subAmendmentOnly: true, take: 500 });
    const ids = ours(rows).map((r) => r.scrutinExternalId);
    expect(ids).toEqual([`${PFX}S_SUB`]);
  });

  it("substanceDepth:['subAmendment'] filters via qualitySignals", async () => {
    const { rows } = await queryQueue({ substanceDepth: ["subAmendment"], take: 500 });
    const ids = ours(rows).map((r) => r.scrutinExternalId);
    expect(ids).toEqual([`${PFX}S_SUB`]);
  });

  it("titleLengthMax:40 excludes long + null titles", async () => {
    const { rows } = await queryQueue({ titleLengthMax: 40, take: 500 });
    const ids = ours(rows).map((r) => r.scrutinExternalId);
    expect(ids).toContain(`${PFX}S_CLEAN`);
    expect(ids).not.toContain(`${PFX}S_WARN`); // long title
    expect(ids).not.toContain(`${PFX}S_FALLBACK`); // null title
  });

  it("q matches officialTitleSnapshot or policyTitle", async () => {
    const { rows } = await queryQueue({ q: "fiscalité agricole", take: 500 });
    const ids = ours(rows).map((r) => r.scrutinExternalId);
    expect(ids).toContain(`${PFX}S_WARN`);
  });

  it("sample:2 returns <=2 rows from the filtered set", async () => {
    const { rows } = await queryQueue({ generationSource: ["LLM"], sample: 2 });
    expect(rows.length).toBeLessThanOrEqual(2);
  });

  it("each returned row has evidenceCount/warningCount/hasBlocker/isSubAmendment populated", async () => {
    const { rows } = await queryQueue({ take: 500 });
    const mine = ours(rows);
    const clean = mine.find((r) => r.scrutinExternalId === `${PFX}S_CLEAN`)!;
    expect(clean.evidenceCount).toBe(2);
    expect(clean.warningCount).toBe(0);
    expect(clean.hasBlocker).toBe(false);
    expect(clean.isSubAmendment).toBe(false);

    const sub = mine.find((r) => r.scrutinExternalId === `${PFX}S_SUB`)!;
    expect(sub.isSubAmendment).toBe(true);
    expect(sub.hasBlocker).toBe(true);
    expect(sub.warningCount).toBe(1);
  });
});
