import { describe, it, expect, afterAll, beforeAll } from "vitest";

import { db } from "@/lib/db";
import {
  detectStalePolicyTitles,
  recomputeInputHashForScrutin,
} from "@/services/sync/detect-stale-policy-titles";

const PFX = "TEST_PT11_";

let approvedScrutinId: string;
let flipScrutinId: string;
let flipAmendmentId: string;
let draftScrutinId: string;

async function cleanup() {
  await db.scrutinPolicyTitle.deleteMany({
    where: { scrutin: { externalId: { startsWith: PFX } } },
  });
  await db.scrutinAmendment.deleteMany({
    where: { amendment: { externalId: { startsWith: PFX } } },
  });
  await db.scrutin.deleteMany({ where: { externalId: { startsWith: PFX } } });
  await db.amendment.deleteMany({ where: { externalId: { startsWith: PFX } } });
  await db.legislativeDossier.deleteMany({ where: { externalId: `${PFX}DLR` } });
}

async function seedScrutin(
  suffix: string,
  summaryText: string
): Promise<{ scrutinId: string; amendmentId: string }> {
  const dossier = await db.legislativeDossier.findUniqueOrThrow({
    where: { externalId: `${PFX}DLR` },
  });
  const amd = await db.amendment.create({
    data: {
      externalId: `${PFX}${suffix}A`,
      number: suffix,
      dossierId: dossier.id,
      status: "ADOPTE",
      legislature: 17,
      chamber: "AN",
      content: `<p>Contenu ${suffix}.</p>`,
      summary: `<p>${summaryText}</p>`,
    },
  });
  const scrutin = await db.scrutin.create({
    data: {
      externalId: `${PFX}${suffix}S`,
      title: `le sous-amendement n° ${suffix} ...`,
      sourceUrl: `https://www.assemblee-nationale.fr/dyn/17/scrutins/test-pt11-${suffix}`,
      votingDate: new Date(),
      legislature: 17,
      chamber: "AN",
      votesFor: 1,
      votesAgainst: 0,
      votesAbstain: 0,
      result: "ADOPTED",
      dossierLegislatifId: dossier.id,
      amendmentLinks: {
        create: [{ amendmentId: amd.id, role: "PRINCIPAL", source: "TITLE_REGEX" }],
      },
    },
  });
  return { scrutinId: scrutin.id, amendmentId: amd.id };
}

async function createPolicyTitleRow(
  scrutinId: string,
  inputHash: string,
  status: "APPROVED" | "NEEDS_REVIEW"
): Promise<void> {
  await db.scrutinPolicyTitle.create({
    data: {
      scrutinId,
      officialTitleSnapshot: "snapshot",
      proceduralLabel: "Amendement n°x",
      sources: [],
      inputHash,
      confidence: "HIGH",
      qualitySignals: {},
      generationSource: "LLM",
      status,
    },
  });
}

beforeAll(async () => {
  await cleanup();
  await db.legislativeDossier.create({
    data: {
      externalId: `${PFX}DLR`,
      slug: `${PFX}dossier`,
      title: "Test dossier PT11",
      status: "EN_COURS",
    },
  });

  const approved = await seedScrutin("100", "Substance stable initiale.");
  approvedScrutinId = approved.scrutinId;
  await createPolicyTitleRow(
    approvedScrutinId,
    await recomputeInputHashForScrutin(approvedScrutinId),
    "APPROVED"
  );

  const flip = await seedScrutin("200", "Substance qui va changer.");
  flipScrutinId = flip.scrutinId;
  flipAmendmentId = flip.amendmentId;
  await createPolicyTitleRow(
    flipScrutinId,
    await recomputeInputHashForScrutin(flipScrutinId),
    "APPROVED"
  );

  const draft = await seedScrutin("300", "Substance pour un DRAFT.");
  draftScrutinId = draft.scrutinId;
  await createPolicyTitleRow(
    draftScrutinId,
    await recomputeInputHashForScrutin(draftScrutinId),
    "NEEDS_REVIEW"
  );
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("detectStalePolicyTitles", () => {
  it("inputs unchanged → APPROVED row stays APPROVED", async () => {
    await detectStalePolicyTitles();
    const row = await db.scrutinPolicyTitle.findUniqueOrThrow({
      where: { scrutinId: approvedScrutinId },
    });
    expect(row.status).toBe("APPROVED");
  });

  it("amendment summary changed → APPROVED row flips to STALE", async () => {
    await db.amendment.update({
      where: { id: flipAmendmentId },
      data: { summary: "<p>Substance entièrement différente maintenant.</p>" },
    });
    const result = await detectStalePolicyTitles();
    expect(result.staled).toBeGreaterThanOrEqual(1);
    const row = await db.scrutinPolicyTitle.findUniqueOrThrow({
      where: { scrutinId: flipScrutinId },
    });
    expect(row.status).toBe("STALE");
  });

  it("non-APPROVED row is ignored by the detector", async () => {
    await db.amendment.update({
      where: { externalId: `${PFX}300A` },
      data: { summary: "<p>Changement ignoré car la row n'est pas APPROVED.</p>" },
    });
    await detectStalePolicyTitles();
    const row = await db.scrutinPolicyTitle.findUniqueOrThrow({
      where: { scrutinId: draftScrutinId },
    });
    expect(row.status).toBe("NEEDS_REVIEW");
  });
});
