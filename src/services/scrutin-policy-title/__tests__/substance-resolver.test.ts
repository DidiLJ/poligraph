import { describe, it, expect, afterAll, beforeAll } from "vitest";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

const PFX = "TEST_PT_";
let scrutinId: string;
let emptyScrutinId: string;
let db: typeof import("@/lib/db").db;
let resolveSubstanceSources: typeof import("@/services/scrutin-policy-title/substance-resolver").resolveSubstanceSources;

describeIfDb("resolveSubstanceSources", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ resolveSubstanceSources } =
      await import("@/services/scrutin-policy-title/substance-resolver"));

    await db.scrutinAmendment.deleteMany({
      where: { amendment: { externalId: { startsWith: PFX } } },
    });
    await db.scrutin.deleteMany({ where: { externalId: { startsWith: PFX } } });
    await db.amendment.deleteMany({ where: { externalId: { startsWith: PFX } } });
    await db.legislativeDossier.deleteMany({ where: { externalId: `${PFX}DLR` } });

    const dossier = await db.legislativeDossier.create({
      data: {
        externalId: `${PFX}DLR`,
        slug: `${PFX}dossier`,
        title: "Test dossier agricole",
        status: "EN_COURS",
      },
    });

    const parent = await db.amendment.create({
      data: {
        externalId: `${PFX}2058`,
        number: "2058",
        dossierId: dossier.id,
        status: "ADOPTE",
        legislature: 17,
        chamber: "AN",
        content: "<p>Contenu du parent 2058.</p>",
        summary: "<p>Expos&#xE9; du parent.</p>",
        identicalGroupKey: "GRP_PT",
      },
    });
    const sub = await db.amendment.create({
      data: {
        externalId: `${PFX}2368`,
        number: "2368",
        dossierId: dossier.id,
        status: "ADOPTE",
        legislature: 17,
        chamber: "AN",
        content: "<p>Supprime la d&#xE9;rogation aux seuils de qualit&#xE9; de l'eau.</p>",
        summary: "<p>Le pr&#xE9;sent sous-amendement supprime une exon&#xE9;ration.</p>",
        parentAmendmentId: parent.id,
      },
    });
    const identical = await db.amendment.create({
      data: {
        externalId: `${PFX}2074`,
        number: "2074",
        dossierId: dossier.id,
        status: "ADOPTE",
        legislature: 17,
        chamber: "AN",
        content: "<p>Identique 2074.</p>",
        identicalGroupKey: "GRP_PT",
      },
    });

    const scrutin = await db.scrutin.create({
      data: {
        externalId: `${PFX}S1`,
        title: "le sous-amendement n° 2368 ...",
        votingDate: new Date(),
        legislature: 17,
        chamber: "AN",
        votesFor: 1,
        votesAgainst: 0,
        votesAbstain: 0,
        result: "ADOPTED",
        dossierLegislatifId: dossier.id,
        amendmentLinks: {
          create: [
            { amendmentId: sub.id, role: "SUB_AMENDMENT", source: "TITLE_REGEX" },
            { amendmentId: parent.id, role: "PARENT_AMENDMENT", source: "TITLE_REGEX" },
            { amendmentId: identical.id, role: "IDENTICAL", source: "TITLE_REGEX" },
          ],
        },
      },
    });
    scrutinId = scrutin.id;

    const emptyAmd = await db.amendment.create({
      data: {
        externalId: `${PFX}EMPTY`,
        number: "9",
        dossierId: dossier.id,
        status: "DEPOSE",
        legislature: 17,
        chamber: "AN",
        content: null,
        summary: null,
      },
    });
    const emptyScrutin = await db.scrutin.create({
      data: {
        externalId: `${PFX}S2`,
        title: "l'amendement n° 9 ...",
        votingDate: new Date(),
        legislature: 17,
        chamber: "AN",
        votesFor: 1,
        votesAgainst: 0,
        votesAbstain: 0,
        result: "ADOPTED",
        dossierLegislatifId: dossier.id,
        amendmentLinks: {
          create: [{ amendmentId: emptyAmd.id, role: "PRINCIPAL", source: "TITLE_REGEX" }],
        },
      },
    });
    emptyScrutinId = emptyScrutin.id;
  });

  afterAll(async () => {
    await db.scrutinAmendment.deleteMany({
      where: { amendment: { externalId: { startsWith: PFX } } },
    });
    await db.scrutin.deleteMany({ where: { externalId: { startsWith: PFX } } });
    await db.amendment.deleteMany({ where: { externalId: { startsWith: PFX } } });
    await db.legislativeDossier.deleteMany({ where: { externalId: `${PFX}DLR` } });
  });

  it("emits sub-amendment blocks first, then parent, then identical — all official, plain text", async () => {
    const r = await resolveSubstanceSources(scrutinId);
    expect(r.substanceDepth).toBe("subAmendment");
    // sub blocks first
    expect(r.blocks[0]!.sourceType).toBe("subAmendment");
    expect(r.blocks.every((b) => b.trust === "official")).toBe(true);
    // plain text (no tags) + entities decoded
    const subContent = r.blocks.find(
      (b) => b.sourceType === "subAmendment" && b.field === "Amendment.content"
    )!;
    expect(subContent.text).toBe("Supprime la dérogation aux seuils de qualité de l'eau.");
    expect(subContent.text).not.toContain("<");
    // exact field attribution
    expect(
      r.blocks.some((b) => b.sourceType === "subAmendment" && b.field === "Amendment.summary")
    ).toBe(true);
    expect(r.blocks.some((b) => b.sourceType === "parentAmendment")).toBe(true);
    expect(r.blocks.some((b) => b.sourceType === "identical")).toBe(true);
    // ordering: first sub index < first parent index < first identical index
    const firstSub = r.blocks.findIndex((b) => b.sourceType === "subAmendment");
    const firstParent = r.blocks.findIndex((b) => b.sourceType === "parentAmendment");
    const firstIdentical = r.blocks.findIndex((b) => b.sourceType === "identical");
    expect(firstSub).toBeLessThan(firstParent);
    expect(firstParent).toBeLessThan(firstIdentical);
  });

  it("returns null depth + NO_SUBSTANCE_FOUND when the only amendment has no content/summary", async () => {
    const r = await resolveSubstanceSources(emptyScrutinId);
    expect(r.blocks).toHaveLength(0);
    expect(r.substanceDepth).toBeNull();
    expect(r.warnings.some((w) => w.code === "NO_SUBSTANCE_FOUND")).toBe(true);
  });

  it("never includes scrutin citizenImpact/summary in blocks (only Amendment + dossier official fields)", async () => {
    // set a citizenImpact on the scrutin; resolver must ignore it
    await db.scrutin.update({
      where: { id: scrutinId },
      data: { citizenImpact: "IMPACT_SENTINEL_TEXT" },
    });
    const r = await resolveSubstanceSources(scrutinId);
    expect(r.blocks.every((b) => !b.text.includes("IMPACT_SENTINEL"))).toBe(true);
  });
});
