import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertSearchDocumentMock = vi.fn(async (_tx: unknown, _input: unknown) => undefined);
const upsertSearchDocumentsMock = vi.fn(async (_tx: unknown, _inputs: unknown) => undefined);
const deleteSearchDocumentsMock = vi.fn(
  async (_tx: unknown, _type: unknown, _ids: unknown) => undefined
);

vi.mock("@/lib/search/documents", () => ({
  upsertSearchDocument: (tx: unknown, input: unknown) => upsertSearchDocumentMock(tx, input),
  upsertSearchDocuments: (tx: unknown, inputs: unknown) => upsertSearchDocumentsMock(tx, inputs),
  deleteSearchDocuments: (tx: unknown, type: unknown, ids: unknown) =>
    deleteSearchDocumentsMock(tx, type, ids),
  deleteSearchDocument: vi.fn(async () => undefined),
}));

const measure = {
  id: "measure-1",
  slug: "camille-riviere-construire-des-logements-publics",
  electionId: "election-1",
  election: { slug: "election-reelle" },
  theme: "LOGEMENT_URBANISME" as const,
  candidacy: {
    candidateName: "Camille Rivière",
    party: { name: "Parti du logement", shortName: "PL" },
  },
  publicationStatus: "PUBLISHED" as const,
  publishedRevisionId: "revision-pub",
  publishedRevision: {
    id: "revision-pub",
    text: "Construire des logements publics.",
    details: "Dans les zones tendues.",
    subtopics: [{ subtopic: { label: "Logement social", aliases: ["HLM", "habitat social"] } }],
    updatedAt: new Date("2026-08-27T12:00:00Z"),
  },
  latestRevision: {
    id: "revision-pub",
    text: "Construire des logements publics.",
    details: "Dans les zones tendues.",
    subtopics: [{ subtopic: { label: "Logement social", aliases: ["HLM", "habitat social"] } }],
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
        url: "/elections/election-reelle/mesures/camille-riviere-construire-des-logements-publics",
        body: "Construire des logements publics.\n\nDans les zones tendues.\n\nCamille Rivière\n\nPL\n\nLogement et urbanisme\n\nLogement social\n\nHLM\n\nhabitat social",
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

  it("regroupe la reconstruction de plusieurs mesures en une écriture bornée", async () => {
    const { syncSearchDocuments } = await import("../search-sync");
    const tx = {
      measure: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([measure])
          .mockResolvedValueOnce([{ id: "measure-1" }]),
      },
    };

    await syncSearchDocuments(tx as never, ["measure-1"]);

    expect(tx.measure.findMany).toHaveBeenCalledTimes(2);
    expect(deleteSearchDocumentsMock).toHaveBeenCalledWith(tx, "MEASURE", []);
    expect(upsertSearchDocumentsMock).toHaveBeenCalledWith(tx, [
      expect.objectContaining({ entityId: "measure-1", visibility: "PUBLIC" }),
    ]);
  });
});
