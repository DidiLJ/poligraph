import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { programEdition: { findMany: findManyMock } },
}));

import { queryBatchReviewGroups } from "../batch-review-query";

describe("queryBatchReviewGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sérialise un lot de brouillons actifs", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "edition-1",
        label: "Cahier 1",
        version: 1,
        candidacy: { candidateName: "Candidate Exemple" },
        party: null,
        election: { title: "Élection présidentielle de 2027" },
        measures: [
          {
            id: "measure-1",
            latestRevision: { id: "revision-1", text: "Créer un service public du logement." },
          },
        ],
      },
    ]);

    await expect(queryBatchReviewGroups()).resolves.toEqual([
      {
        programEditionId: "edition-1",
        editionLabel: "Cahier 1",
        editionVersion: 1,
        ownerLabel: "Candidate Exemple",
        electionTitle: "Élection présidentielle de 2027",
        items: [
          {
            measureId: "measure-1",
            revisionId: "revision-1",
            text: "Créer un service public du logement.",
          },
        ],
        hasMore: false,
      },
    ]);
  });

  it("demande uniquement les premières publications non relues et sourcées", async () => {
    findManyMock.mockResolvedValue([]);

    await queryBatchReviewGroups();

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          measures: {
            some: expect.objectContaining({
              publicationStatus: "DRAFT",
              publishedRevisionId: null,
              latestRevision: {
                is: expect.objectContaining({
                  reviewedAt: null,
                  rejectedAt: null,
                  sources: { some: {} },
                }),
              },
            }),
          },
        },
      })
    );
  });

  it("borne le lot à la candidature sélectionnée", async () => {
    findManyMock.mockResolvedValue([]);

    await queryBatchReviewGroups({ candidacyId: "candidature-1" });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          candidacyId: "candidature-1",
          measures: {
            some: expect.objectContaining({ candidacyId: "candidature-1" }),
          },
        },
        select: expect.objectContaining({
          measures: expect.objectContaining({
            where: expect.objectContaining({ candidacyId: "candidature-1" }),
          }),
        }),
      })
    );
  });
});
