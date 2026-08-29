import { describe, expect, it, vi } from "vitest";
import { deleteSearchDocuments, upsertSearchDocuments } from "../documents";

const makeInput = (index: number) => ({
  entityType: "MEASURE" as const,
  entityId: `measure-${index}`,
  electionId: "election-1",
  title: `Mesure ${index}`,
  body: `Contenu ${index}`,
  url: `/mesures/measure-${index}`,
  visibility: "PUBLIC" as const,
  sourceRevisionId: `revision-${index}`,
  sourceUpdatedAt: new Date("2026-08-30T00:00:00.000Z"),
});

describe("écritures groupées des documents de recherche", () => {
  it("borne chaque lot à cent documents", async () => {
    const tx = {
      searchDocument: { createMany: vi.fn(async (_args: { data: unknown[] }) => ({ count: 0 })) },
      $executeRaw: vi.fn(async () => 0),
    };

    await upsertSearchDocuments(
      tx as never,
      Array.from({ length: 101 }, (_, index) => makeInput(index))
    );

    expect(tx.searchDocument.createMany).toHaveBeenCalledTimes(2);
    expect(tx.searchDocument.createMany.mock.calls[0]?.[0]?.data).toHaveLength(100);
    expect(tx.searchDocument.createMany.mock.calls[1]?.[0]?.data).toHaveLength(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("supprime plusieurs documents en une seule requête", async () => {
    const tx = { searchDocument: { deleteMany: vi.fn(async () => ({ count: 2 })) } };

    await deleteSearchDocuments(tx as never, "MEASURE", ["measure-1", "measure-2"]);

    expect(tx.searchDocument.deleteMany).toHaveBeenCalledWith({
      where: { entityType: "MEASURE", entityId: { in: ["measure-1", "measure-2"] } },
    });
  });
});
