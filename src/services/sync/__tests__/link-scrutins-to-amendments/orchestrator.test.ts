import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { linkScrutinsToAmendments } from "@/services/sync/link-scrutins-to-amendments";

const DOSSIER_EXT = "TEST_ORCH_DLR_1";
const AMEND_PFX = "TEST_ORCH_A_";
const SCRUTIN_EXT = "TEST_ORCH_S_1";

let scrutinId: string;

beforeAll(async () => {
  // FK-safe cleanup of any leftovers from a previous aborted run.
  await db.scrutinAmendment.deleteMany({
    where: { scrutin: { externalId: SCRUTIN_EXT } },
  });
  await db.scrutin.deleteMany({ where: { externalId: SCRUTIN_EXT } });
  await db.amendment.deleteMany({ where: { externalId: { startsWith: AMEND_PFX } } });
  await db.legislativeDossier.deleteMany({ where: { externalId: DOSSIER_EXT } });

  const dossier = await db.legislativeDossier.create({
    data: {
      externalId: DOSSIER_EXT,
      slug: "test-orch-dossier",
      title: "Test orchestrator dossier",
      status: "EN_COURS",
    },
  });

  await db.amendment.createMany({
    data: [
      {
        externalId: `${AMEND_PFX}2058`,
        number: "2058",
        texteRef: "TEST_ORCH_PIONANR_1",
        dossierId: dossier.id,
        status: "ADOPTE",
        legislature: 17,
        chamber: "AN",
      },
      {
        externalId: `${AMEND_PFX}2368`,
        number: "2368",
        texteRef: "TEST_ORCH_PIONANR_1",
        dossierId: dossier.id,
        status: "ADOPTE",
        legislature: 17,
        chamber: "AN",
      },
    ],
  });

  const scrutin = await db.scrutin.create({
    data: {
      externalId: SCRUTIN_EXT,
      title: "le sous-amendement n° 2368 de M. Potier à l'amendement n° 2058 du Gouvernement",
      votingDate: new Date("2026-05-22T10:00:00Z"),
      legislature: 17,
      chamber: "AN",
      votesFor: 287,
      votesAgainst: 222,
      votesAbstain: 14,
      result: "ADOPTED",
      dossierLegislatifId: dossier.id,
    },
  });
  scrutinId = scrutin.id;
});

afterAll(async () => {
  await db.scrutinAmendment.deleteMany({
    where: { scrutin: { externalId: SCRUTIN_EXT } },
  });
  await db.scrutin.deleteMany({ where: { externalId: SCRUTIN_EXT } });
  await db.amendment.deleteMany({ where: { externalId: { startsWith: AMEND_PFX } } });
  await db.legislativeDossier.deleteMany({ where: { externalId: DOSSIER_EXT } });
  await db.$disconnect();
});

describe("linkScrutinsToAmendments (orchestrator)", () => {
  it("links the sub + parent amendments for a single dossier-scoped scrutin", async () => {
    const stats = await linkScrutinsToAmendments({ scrutinIds: [scrutinId], dryRun: false });

    expect(stats.scrutinsScanned).toBe(1);
    expect(stats.scrutinsLinked).toBe(1);
    expect(stats.linksCreated).toBeGreaterThanOrEqual(2);
    expect(stats.byRole.SUB_AMENDMENT).toBeGreaterThanOrEqual(1);
    expect(stats.byRole.PARENT_AMENDMENT).toBeGreaterThanOrEqual(1);
    expect(stats.byRole.INFERRED).toBe(0);
    expect(stats.byRole.UNKNOWN).toBe(0);
  });

  it("is idempotent: a second run creates nothing and skips the duplicates", async () => {
    const stats = await linkScrutinsToAmendments({ scrutinIds: [scrutinId], dryRun: false });

    expect(stats.scrutinsScanned).toBe(1);
    expect(stats.linksCreated).toBe(0);
    expect(stats.linksSkippedDuplicate).toBeGreaterThanOrEqual(2);
  });
});
