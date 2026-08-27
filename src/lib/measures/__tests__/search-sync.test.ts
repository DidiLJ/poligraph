import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertSearchDocumentMock = vi.fn(async (_tx: unknown, _input: unknown) => undefined);

vi.mock("@/lib/search/documents", () => ({
  upsertSearchDocument: (tx: unknown, input: unknown) => upsertSearchDocumentMock(tx, input),
  deleteSearchDocument: vi.fn(async () => undefined),
}));

const measure = {
  electionId: "election-1",
  election: { slug: "election-reelle" },
  publicationStatus: "PUBLISHED" as const,
  publishedRevisionId: "revision-pub",
  publishedRevision: {
    id: "revision-pub",
    text: "Construire des logements publics.",
    updatedAt: new Date("2026-08-27T12:00:00Z"),
  },
  latestRevision: {
    id: "revision-pub",
    text: "Construire des logements publics.",
    updatedAt: new Date("2026-08-27T12:00:00Z"),
  },
};

function transaction(isPublic: boolean) {
  return {
    measure: {
      findUniqueOrThrow: vi.fn(async () => measure),
      findFirst: vi.fn(async () => (isPublic ? { id: "measure-1" } : null)),
    },
  };
}

describe("synchronisation recherche des mesures", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dérive electionId et URL du slug réel", async () => {
    const { syncSearchDocument } = await import("../search-sync");
    const tx = transaction(true);

    await syncSearchDocument(tx as never, "measure-1");

    expect(upsertSearchDocumentMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        electionId: "election-1",
        url: "/elections/election-reelle/mesures/measure-1",
        visibility: "PUBLIC",
      })
    );
  });

  it("conserve le document mais le ferme si la fiche porteuse est fermée", async () => {
    const { syncSearchDocument } = await import("../search-sync");
    const tx = transaction(false);

    await syncSearchDocument(tx as never, "measure-1");

    expect(upsertSearchDocumentMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ visibility: "ADMIN_ONLY" })
    );
  });
});
