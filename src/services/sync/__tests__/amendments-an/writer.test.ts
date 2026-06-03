import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { NormalizedAmendment } from "@/services/sync/amendments-an/types";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

type Writer = typeof import("@/services/sync/amendments-an/writer");
let db: typeof import("@/lib/db").db;
let writeAmendmentBatch: Writer["writeAmendmentBatch"];
let resolveParents: Writer["resolveParents"];
let resolveIdenticalGroups: Writer["resolveIdenticalGroups"];
let computeIdenticalGroupKey: Writer["computeIdenticalGroupKey"];

const base = (over: Partial<NormalizedAmendment>): NormalizedAmendment => ({
  externalId: "TEST_AMW_x",
  number: "1",
  texteRef: "PIONANR_T",
  dossierRefFromPath: null,
  article: null,
  content: null,
  summary: null,
  status: "DEPOSE",
  parentExternalId: null,
  identicalDiscussionId: null,
  authorType: null,
  authorName: null,
  legislature: 17,
  chamber: "AN",
  ...over,
});

describeIfDb("amendments-an writer", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ writeAmendmentBatch, resolveParents, resolveIdenticalGroups, computeIdenticalGroupKey } =
      await import("@/services/sync/amendments-an/writer"));
  });

  afterAll(async () => {
    await db.amendment.deleteMany({ where: { externalId: { startsWith: "TEST_AMW_" } } });
  });

  describe("writeAmendmentBatch", () => {
    it("upserts idempotently by externalId (2nd run = 0 created)", async () => {
      const batch = [
        base({ externalId: "TEST_AMW_a", number: "CL8" }),
        base({ externalId: "TEST_AMW_b", number: "I-390" }),
      ];
      const r1 = await writeAmendmentBatch(batch);
      expect(r1.created).toBe(2);
      expect(r1.updated).toBe(0);

      const r2 = await writeAmendmentBatch(batch);
      expect(r2.created).toBe(0);
      expect(r2.updated).toBe(2);

      const a = await db.amendment.findUnique({ where: { externalId: "TEST_AMW_a" } });
      expect(a?.number).toBe("CL8");
    });

    it("reports dossier-resolved vs unresolved counts", async () => {
      const batch = [
        base({
          externalId: "TEST_AMW_d1",
          dossierRefFromPath: "TEST_AMW_NON_EXISTENT_DOSSIER_REF_1",
        }),
        base({ externalId: "TEST_AMW_d2", dossierRefFromPath: null }),
      ];
      const r = await writeAmendmentBatch(batch);
      expect(r.dossiersResolved).toBe(0);
      expect(r.dossiersUnresolved).toBe(1); // d1 had a non-existent ref; d2 had no ref (not counted either way)
    });
  });

  describe("resolveParents", () => {
    it("resolves parent links in a second pass regardless of order", async () => {
      await writeAmendmentBatch([
        base({ externalId: "TEST_AMW_child", parentExternalId: "TEST_AMW_parent" }),
        base({ externalId: "TEST_AMW_parent" }),
      ]);
      const stats = await resolveParents([
        base({ externalId: "TEST_AMW_child", parentExternalId: "TEST_AMW_parent" }),
      ]);
      expect(stats.resolved).toBe(1);
      expect(stats.deferred).toBe(0);
      const child = await db.amendment.findUnique({
        where: { externalId: "TEST_AMW_child" },
        include: { parentAmendment: true },
      });
      expect(child?.parentAmendment?.externalId).toBe("TEST_AMW_parent");
    });

    it("defers parents that aren't in the DB yet", async () => {
      await writeAmendmentBatch([
        base({ externalId: "TEST_AMW_orphan", parentExternalId: "TEST_AMW_missing_parent" }),
      ]);
      const stats = await resolveParents([
        base({ externalId: "TEST_AMW_orphan", parentExternalId: "TEST_AMW_missing_parent" }),
      ]);
      expect(stats.resolved).toBe(0);
      expect(stats.deferred).toBe(1);
    });
  });

  describe("resolveIdenticalGroups", () => {
    it("computes a deterministic key shared across a group", async () => {
      await writeAmendmentBatch([
        base({ externalId: "TEST_AMW_i1", identicalDiscussionId: "G1" }),
        base({ externalId: "TEST_AMW_i2", identicalDiscussionId: "G1" }),
      ]);
      const stats = await resolveIdenticalGroups([
        base({ externalId: "TEST_AMW_i1", identicalDiscussionId: "G1" }),
        base({ externalId: "TEST_AMW_i2", identicalDiscussionId: "G1" }),
      ]);
      expect(stats.groups).toBe(1);
      const i1 = await db.amendment.findUnique({ where: { externalId: "TEST_AMW_i1" } });
      const i2 = await db.amendment.findUnique({ where: { externalId: "TEST_AMW_i2" } });
      expect(i1?.identicalGroupKey).toBeTruthy();
      expect(i1?.identicalGroupKey).toBe(i2?.identicalGroupKey);
    });

    it("computeIdenticalGroupKey is deterministic for the same discussion id", () => {
      expect(computeIdenticalGroupKey("ABC")).toBe(computeIdenticalGroupKey("ABC"));
      expect(computeIdenticalGroupKey("ABC")).not.toBe(computeIdenticalGroupKey("XYZ"));
    });
  });
});
