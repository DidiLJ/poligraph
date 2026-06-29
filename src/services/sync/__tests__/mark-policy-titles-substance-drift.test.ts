import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PolicyTitleStatus, RegenerationStatus } from "@/generated/prisma";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

const PFX = "TEST_PTD_";

type Mark = typeof import("@/services/sync/mark-policy-titles-substance-drift");
let db: typeof import("@/lib/db").db;
let markPolicyTitlesForSubstanceDrift: Mark["markPolicyTitlesForSubstanceDrift"];

describeIfDb("markPolicyTitlesForSubstanceDrift", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ markPolicyTitlesForSubstanceDrift } =
      await import("@/services/sync/mark-policy-titles-substance-drift"));
  });

  afterAll(async () => {
    await db.scrutinAmendment.deleteMany({
      where: { amendment: { externalId: { startsWith: PFX } } },
    });
    await db.scrutinPolicyTitle.deleteMany({
      where: { scrutin: { externalId: { startsWith: PFX } } },
    });
    await db.amendment.deleteMany({ where: { externalId: { startsWith: PFX } } });
    await db.scrutin.deleteMany({ where: { externalId: { startsWith: PFX } } });
  });

  const seedScrutin = (ext: string) =>
    db.scrutin.create({
      data: {
        externalId: PFX + ext,
        title: "Test scrutin " + ext,
        votingDate: new Date("2026-01-01"),
        legislature: 17,
        result: "ADOPTED",
        votesFor: 0,
        votesAgainst: 0,
        votesAbstain: 0,
      },
    });

  const seedAmendment = (ext: string) =>
    db.amendment.create({
      data: { externalId: PFX + ext, number: "1", status: "DEPOSE", legislature: 17 },
    });

  const seedTitle = (
    scrutinId: string,
    status: PolicyTitleStatus,
    regenerationStatus: RegenerationStatus = "idle"
  ) =>
    db.scrutinPolicyTitle.create({
      data: {
        scrutinId,
        officialTitleSnapshot: "Snapshot officiel",
        inputHash: "hash",
        proceduralLabel: "Label procédural",
        confidence: "HIGH",
        qualitySignals: {},
        generationSource: "LLM",
        status,
        regenerationStatus,
      },
    });

  const link = (scrutinId: string, amendmentId: string) =>
    db.scrutinAmendment.create({
      data: { scrutinId, amendmentId, role: "PRINCIPAL", source: "TITLE_REGEX" },
    });

  it("empty signal -> no-op, all zeros", async () => {
    const r = await markPolicyTitlesForSubstanceDrift([]);
    expect(r).toEqual({
      changedSubstanceAmendmentIds: 0,
      linkedScrutins: 0,
      policyTitlesMarkedStale: 0,
      policyTitlesQueuedOrFlagged: 0,
      policyTitlesIgnored: 0,
    });
  });

  it("amendment with no ScrutinAmendment -> no-op", async () => {
    const a = await seedAmendment("orphan");
    const r = await markPolicyTitlesForSubstanceDrift([a.id]);
    expect(r.changedSubstanceAmendmentIds).toBe(1);
    expect(r.linkedScrutins).toBe(0);
    expect(r.policyTitlesMarkedStale).toBe(0);
    expect(r.policyTitlesQueuedOrFlagged).toBe(0);
  });

  it("APPROVED title -> STALE", async () => {
    const sc = await seedScrutin("appr");
    const a = await seedAmendment("appr_a");
    await link(sc.id, a.id);
    const t = await seedTitle(sc.id, "APPROVED");

    const r = await markPolicyTitlesForSubstanceDrift([a.id]);
    expect(r.linkedScrutins).toBe(1);
    expect(r.policyTitlesMarkedStale).toBe(1);

    const after = await db.scrutinPolicyTitle.findUnique({ where: { id: t.id } });
    expect(after?.status).toBe("STALE");
  });

  it("multiple amendments of the same scrutin -> a single title update", async () => {
    const sc = await seedScrutin("multi");
    const a1 = await seedAmendment("multi_a1");
    const a2 = await seedAmendment("multi_a2");
    await link(sc.id, a1.id);
    await link(sc.id, a2.id);
    const t = await seedTitle(sc.id, "APPROVED");

    const r = await markPolicyTitlesForSubstanceDrift([a1.id, a2.id]);
    expect(r.changedSubstanceAmendmentIds).toBe(2);
    expect(r.linkedScrutins).toBe(1); // deduped
    expect(r.policyTitlesMarkedStale).toBe(1); // one title, one update

    const after = await db.scrutinPolicyTitle.findUnique({ where: { id: t.id } });
    expect(after?.status).toBe("STALE");
  });

  it("NEEDS_REVIEW -> stays NEEDS_REVIEW, queued, never approved/published", async () => {
    const sc = await seedScrutin("nr");
    const a = await seedAmendment("nr_a");
    await link(sc.id, a.id);
    const t = await seedTitle(sc.id, "NEEDS_REVIEW", "idle");

    const r = await markPolicyTitlesForSubstanceDrift([a.id]);
    expect(r.policyTitlesQueuedOrFlagged).toBe(1);
    expect(r.policyTitlesMarkedStale).toBe(0);

    const after = await db.scrutinPolicyTitle.findUnique({ where: { id: t.id } });
    expect(after?.status).toBe("NEEDS_REVIEW"); // not approved, not published
    expect(after?.regenerationStatus).toBe("queued");
  });

  it("already STALE -> no-op (ignored)", async () => {
    const sc = await seedScrutin("stale");
    const a = await seedAmendment("stale_a");
    await link(sc.id, a.id);
    const t = await seedTitle(sc.id, "STALE");

    const r = await markPolicyTitlesForSubstanceDrift([a.id]);
    expect(r.policyTitlesIgnored).toBe(1);
    expect(r.policyTitlesMarkedStale).toBe(0);

    const after = await db.scrutinPolicyTitle.findUnique({ where: { id: t.id } });
    expect(after?.status).toBe("STALE");
  });

  it("REJECTED -> no-op (ignored, never reactivated)", async () => {
    const sc = await seedScrutin("rej");
    const a = await seedAmendment("rej_a");
    await link(sc.id, a.id);
    const t = await seedTitle(sc.id, "REJECTED");

    const r = await markPolicyTitlesForSubstanceDrift([a.id]);
    expect(r.policyTitlesIgnored).toBe(1);
    expect(r.policyTitlesMarkedStale).toBe(0);
    expect(r.policyTitlesQueuedOrFlagged).toBe(0);

    const after = await db.scrutinPolicyTitle.findUnique({ where: { id: t.id } });
    expect(after?.status).toBe("REJECTED");
  });
});
