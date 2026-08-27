import { describe, expect, it } from "vitest";
import { AFFAIR_EVOLUTION_REVELATION_TITLE } from "@/lib/security/schemas/affair-proposal";
import { selectProposalIdsForBatch } from "@/services/affairs/proposal-batch";

const eventPatch = {
  addEvent: {
    date: "2026-08-27T08:00:00.000Z",
    type: "REVELATION",
    title: AFFAIR_EVOLUTION_REVELATION_TITLE,
    description: null,
    sourceUrl: "https://www.lemonde.fr/politique/article-test.html",
    sourceTitle: "Titre original",
  },
};

describe("selectProposalIdsForBatch", () => {
  it("exclut un événement sans opt-in explicite", () => {
    expect(
      selectProposalIdsForBatch(
        ["patch-1", "event-1"],
        [
          { id: "patch-1", proposedPatch: { court: "Tribunal judiciaire de Paris" } },
          { id: "event-1", proposedPatch: eventPatch },
        ],
        false
      )
    ).toEqual({ acceptedIds: ["patch-1"], excludedEventIds: ["event-1"] });
  });

  it("inclut un événement avec l’opt-in explicite", () => {
    expect(
      selectProposalIdsForBatch(["event-1"], [{ id: "event-1", proposedPatch: eventPatch }], true)
    ).toEqual({ acceptedIds: ["event-1"], excludedEventIds: [] });
  });
});
