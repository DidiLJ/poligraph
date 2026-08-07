import { afterAll, beforeAll, expect, it } from "vitest";
import { assertDisposableTestDb, describeIfDisposableDb } from "@/test/db-guard";

// Deferred: these modules import @/lib/db as a value, which throws at module load without DATABASE_URL.
let db: typeof import("@/lib/db").db;
let loadPrioritesData: typeof import("../priorites").loadPrioritesData;
let getPrioritesData: typeof import("../priorites").getPrioritesData;

const SLUG = "priorites-test";

/**
 * The eligibility calculation, on the hub fixture: Alpha and Bravo carry a published extension and
 * one measure each, Charlie carries a published measure behind a DRAFT extension, Delta has an
 * incomplete source and is not in the field at all.
 *
 * That shape is what makes the parity rule testable. Charlie must appear in the trailing "other
 * candidacies" count (the field is the whole race) while contributing nothing to the documented
 * rows (a measure no subject page can reach must not make a candidacy look documented).
 */
describeIfDisposableDb("priorites", () => {
  let electionId: string;

  beforeAll(async () => {
    assertDisposableTestDb();
    ({ db } = await import("@/lib/db"));
    ({ loadPrioritesData, getPrioritesData } = await import("../priorites"));
    const { seedHubFixture } = await import("./hub-fixture");
    electionId = await seedHubFixture(db, { electionSlug: SLUG });
  });

  afterAll(async () => {
    await db.candidacy.deleteMany({ where: { electionId } });
    await db.politician.deleteMany({ where: { slug: { startsWith: SLUG } } });
    await db.election.deleteMany({ where: { slug: SLUG } });
    await db.$disconnect();
  });

  it("ne documente que les candidatures dont l'extension est publiée", async () => {
    const data = await loadPrioritesData(electionId, SLUG);

    expect(data.documentedRows.map((r) => r.candidateName)).toEqual([
      "Alpha Fixture",
      "Bravo Fixture",
    ]);
    // Charlie porte une mesure publiée, mais derrière une extension DRAFT : il est compté parmi
    // les candidatures du champ sans ligne à lui, jamais retiré silencieusement.
    expect(data.undocumentedCount).toBe(1);
  });

  it("compte les mesures, les sujets et la part de sources primaires de chaque ligne", async () => {
    const data = await loadPrioritesData(electionId, SLUG);
    const alpha = data.documentedRows.find((r) => r.candidateName === "Alpha Fixture");

    expect(alpha?.verifiedMeasureCount).toBe(1);
    expect(alpha?.themesCoveredCount).toBe(1);
    expect(alpha?.primarySourceMeasureCount).toBe(1);
    expect(alpha?.primarySourceShare).toBe(1);
    // La mesure vient d'un discours de campagne, pas d'une édition de programme.
    expect(alpha?.programmeMeasureCount).toBe(0);
    expect(alpha?.eligible).toBe(false);
  });

  it("reste fermée, sans écart calculable ni corpus de même nature", async () => {
    const data = await loadPrioritesData(electionId, SLUG);

    expect(data.eligibleCount).toBe(0);
    // Null, et non zéro : « moins de deux candidatures éligibles » n'est pas « écart satisfaisant ».
    expect(data.coverageRatio).toBeNull();
    expect(data.coverageExtremes).toBeNull();
    expect(data.corpusSameNature).toBe(false);
    expect(data.segmentationDoctrinePublished).toBe(false);
    expect(data.publishable).toBe(false);
  });

  it("renvoie les sujets déjà comparables et la date de dernière revue", async () => {
    const data = await loadPrioritesData(electionId, SLUG);

    expect(data.publishableThemes.map((t) => t.slug)).toEqual(["logement-urbanisme"]);
    expect(data.lastReviewedAt).not.toBeNull();
  });

  it("rattache une mesure à une édition de programme publiée", async () => {
    // Le seul chemin par lequel `corpusSameNature` peut devenir vrai : sans cette assertion, un
    // `programmeMeasureCount` bloqué à zéro passerait inaperçu, puisque la page est fermée de
    // toute façon et qu'aucun autre test ne regarde ce compteur.
    const alphaCandidacy = await db.candidacy.findFirstOrThrow({
      where: { electionId, candidateName: "Alpha Fixture" },
      select: { id: true },
    });
    const edition = await db.programEdition.create({
      data: {
        electionId,
        ownerType: "CANDIDACY",
        candidacyId: alphaCandidacy.id,
        label: "Programme de test",
        version: 1,
        publishedAt: new Date("2027-01-15T00:00:00Z"),
        documentUrl: "https://example.org/programme.pdf",
        publicationStatus: "PUBLISHED",
      },
      select: { id: true },
    });
    const measure = await db.measure.findFirstOrThrow({
      where: { electionId, candidacyId: alphaCandidacy.id },
      select: { id: true },
    });
    await db.measure.update({
      where: { id: measure.id },
      data: { programEditionId: edition.id },
    });

    try {
      const data = await loadPrioritesData(electionId, SLUG);
      const alpha = data.documentedRows.find((r) => r.candidateName === "Alpha Fixture");
      expect(alpha?.programmeMeasureCount).toBe(1);
      expect(alpha?.verifiedMeasureCount).toBe(1);
    } finally {
      await db.measure.update({ where: { id: measure.id }, data: { programEditionId: null } });
      await db.programEdition.delete({ where: { id: edition.id } });
    }
  });

  it("ne compte pas une édition de programme restée en brouillon", async () => {
    const bravoCandidacy = await db.candidacy.findFirstOrThrow({
      where: { electionId, candidateName: "Bravo Fixture" },
      select: { id: true },
    });
    const edition = await db.programEdition.create({
      data: {
        electionId,
        ownerType: "CANDIDACY",
        candidacyId: bravoCandidacy.id,
        label: "Programme non publié",
        version: 1,
        publishedAt: new Date("2027-01-15T00:00:00Z"),
        documentUrl: "https://example.org/brouillon.pdf",
        publicationStatus: "DRAFT",
      },
      select: { id: true },
    });
    const measure = await db.measure.findFirstOrThrow({
      where: { electionId, candidacyId: bravoCandidacy.id },
      select: { id: true },
    });
    await db.measure.update({ where: { id: measure.id }, data: { programEditionId: edition.id } });

    try {
      const data = await loadPrioritesData(electionId, SLUG);
      const bravo = data.documentedRows.find((r) => r.candidateName === "Bravo Fixture");
      // Rattachée, mais à une édition que le public ne voit pas : elle ne prouve pas que la
      // mesure vient d'un programme officiel complet.
      expect(bravo?.programmeMeasureCount).toBe(0);
    } finally {
      await db.measure.update({ where: { id: measure.id }, data: { programEditionId: null } });
      await db.programEdition.delete({ where: { id: edition.id } });
    }
  });

  it("rend null pour une élection inconnue, avant la frontière de cache", async () => {
    expect(await getPrioritesData("inconnue")).toBeNull();
  });
});
