import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { ResolvedLink } from "@/services/sync/link-scrutins-to-amendments/types";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

let db: typeof import("@/lib/db").db;
let writeScrutinAmendments: typeof import("@/services/sync/link-scrutins-to-amendments/writer").writeScrutinAmendments;

let scrutinId: string;
let amendmentId: string;

describeIfDb("writeScrutinAmendments", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ writeScrutinAmendments } =
      await import("@/services/sync/link-scrutins-to-amendments/writer"));
    await db.scrutinAmendment.deleteMany({
      where: { scrutin: { externalId: { startsWith: "TEST_W_" } } },
    });
    await db.scrutin.deleteMany({ where: { externalId: { startsWith: "TEST_W_" } } });
    await db.amendment.deleteMany({ where: { externalId: { startsWith: "TEST_W_" } } });
    const s = await db.scrutin.create({
      data: {
        externalId: "TEST_W_S",
        title: "test",
        votingDate: new Date(),
        legislature: 17,
        chamber: "AN",
        votesFor: 1,
        votesAgainst: 0,
        votesAbstain: 0,
        result: "ADOPTED",
      },
    });
    const a = await db.amendment.create({
      data: {
        externalId: "TEST_W_A",
        number: "1",
        legislature: 17,
        chamber: "AN",
        status: "DEPOSE",
      },
    });
    scrutinId = s.id;
    amendmentId = a.id;
  });

  afterAll(async () => {
    await db.scrutinAmendment.deleteMany({
      where: { scrutin: { externalId: { startsWith: "TEST_W_" } } },
    });
    await db.scrutin.deleteMany({ where: { externalId: { startsWith: "TEST_W_" } } });
    await db.amendment.deleteMany({ where: { externalId: { startsWith: "TEST_W_" } } });
  });

  const link = (): ResolvedLink => ({
    scrutinId,
    amendmentId,
    role: "PRINCIPAL",
    parserConfidence: 0.9,
    parserWarnings: [],
  });

  it("createMany skipDuplicates: first call writes, second is a no-op", async () => {
    const r1 = await writeScrutinAmendments([link()]);
    expect(r1.created).toBe(1);
    expect(r1.skipped).toBe(0);
    const r2 = await writeScrutinAmendments([link()]);
    expect(r2.created).toBe(0);
    expect(r2.skipped).toBe(1);
  });

  it("writes source = TITLE_REGEX for every row", async () => {
    const rows = await db.scrutinAmendment.findMany({
      where: { scrutinId },
      select: { source: true },
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.source === "TITLE_REGEX")).toBe(true);
  });

  it("returns {created:0, skipped:0} for an empty input", async () => {
    const r = await writeScrutinAmendments([]);
    expect(r).toEqual({ created: 0, skipped: 0 });
  });
});
