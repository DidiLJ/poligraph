import { beforeEach, describe, expect, it, vi } from "vitest";

const { candidacyFindManyMock } = vi.hoisted(() => ({ candidacyFindManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    candidacy: { findMany: candidacyFindManyMock },
  },
}));

import { listMeasureQueueCandidates } from "../queue-query";

describe("listMeasureQueueCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("liste par ordre neutre les seules candidatures qui possèdent des mesures", async () => {
    candidacyFindManyMock.mockResolvedValue([
      {
        id: "candidature-1",
        candidateName: "Alix Démonstration",
        election: { title: "Élection présidentielle de 2027" },
      },
    ]);

    await expect(listMeasureQueueCandidates()).resolves.toEqual([
      {
        id: "candidature-1",
        candidateName: "Alix Démonstration",
        electionTitle: "Élection présidentielle de 2027",
      },
    ]);
    expect(candidacyFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { measures: { some: {} } },
        orderBy: [{ candidateName: "asc" }, { election: { title: "asc" } }],
      })
    );
  });
});
