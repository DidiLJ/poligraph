import { afterAll, beforeAll, expect, it } from "vitest";
import { assertDisposableTestDb, describeIfDisposableDb } from "@/test/db-guard";

let db: typeof import("@/lib/db").db;
let acceptProposal: typeof import("@/services/affairs/proposal-review").acceptProposal;
let proposeAffairEvent: typeof import("@/services/affairs/proposals").proposeAffairEvent;

it("garde le test PostgreSQL derrière le garde de base jetable", () => {
  expect(describeIfDisposableDb).toBeDefined();
});

describeIfDisposableDb("propositions d’événement concurrentes", () => {
  beforeAll(async () => {
    assertDisposableTestDb();
    ({ db } = await import("@/lib/db"));
    ({ acceptProposal } = await import("@/services/affairs/proposal-review"));
    ({ proposeAffairEvent } = await import("@/services/affairs/proposals"));
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("crée un seul événement pour deux propositions distinctes de même identité", async () => {
    const suffix = crypto.randomUUID();
    const politician = await db.politician.create({
      data: {
        slug: `test-evolution-${suffix}`,
        firstName: "Test",
        lastName: "Évolution",
        fullName: "Test Évolution",
      },
    });
    const affair = await db.affair.create({
      data: {
        politicianId: politician.id,
        slug: `test-affaire-evolution-${suffix}`,
        title: "Affaire de test concurrent",
        description: "Donnée de test jetable.",
        status: "ENQUETE_PRELIMINAIRE",
        category: "FAVORITISME",
        publicationStatus: "DRAFT",
      },
    });
    const importRun = await db.importRun.create({
      data: { importer: "test-affair-evolution", status: "COMPLETED", finishedAt: new Date() },
    });

    const proposalIds: string[] = [];
    try {
      const base = {
        affairId: affair.id,
        importer: "test-affair-evolution",
        importRunId: importRun.id,
        sourceUrl: "https://www.lemonde.fr/politique/article/test-concurrent.html",
        sourceTitle: "Article de test concurrent",
        publishedAt: new Date("2026-08-27T08:00:00.000Z"),
        publisher: "Le Monde",
        sourceExcerpt: "Extrait vérifié de la source de test.",
        confidence: 55,
        rationale: "Test de sérialisation PostgreSQL.",
        extractorVersion: "integration-v1",
      };
      const first = await proposeAffairEvent({ ...base, sourceContentHash: "version-1" });
      const second = await proposeAffairEvent({ ...base, sourceContentHash: "version-2" });
      proposalIds.push(first.pendingProposalId!, second.pendingProposalId!);

      const results = await Promise.all([
        acceptProposal({ proposalId: proposalIds[0]!, reviewedBy: "test" }),
        acceptProposal({ proposalId: proposalIds[1]!, reviewedBy: "test" }),
      ]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok && result.reason === "conflict")).toHaveLength(
        1
      );
      await expect(db.affairEvent.count({ where: { affairId: affair.id } })).resolves.toBe(1);
      const proposals = await db.affairUpdateProposal.findMany({
        where: { id: { in: proposalIds } },
        select: { status: true },
      });
      expect(proposals.map((proposal) => proposal.status).sort()).toEqual(["APPROVED", "CONFLICT"]);
    } finally {
      const eventIds = (
        await db.affairEvent.findMany({ where: { affairId: affair.id }, select: { id: true } })
      ).map((event) => event.id);
      await db.auditLog.deleteMany({ where: { entityId: { in: [...proposalIds, ...eventIds] } } });
      await db.affairUpdateProposal.deleteMany({ where: { id: { in: proposalIds } } });
      await db.importRun.delete({ where: { id: importRun.id } });
      await db.politician.delete({ where: { id: politician.id } });
    }
  });
});
