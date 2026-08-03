import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/affairs/publish-guard", () => ({ checkPublishable: vi.fn() }));
vi.mock("@/lib/affairs/blocking-decisions", () => ({ loadBlockingDecisions: vi.fn() }));

import { checkPublishable } from "@/lib/affairs/publish-guard";
import { loadBlockingDecisions } from "@/lib/affairs/blocking-decisions";
import { loadBlockingDecisionsForAffair } from "@/lib/affairs/affair-blocking";

const checkMock = vi.mocked(checkPublishable);
const loadMock = vi.mocked(loadBlockingDecisions);

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * La page modifier veut afficher, au chargement, les rattachements qui bloquent la
 * publication. La garde reste l'autorité : ce helper ne fait que réunir ses identifiants
 * bloquants et charger de quoi les juger.
 */
describe("loadBlockingDecisionsForAffair", () => {
  it("réunit les identifiants des raisons de matching et charge leur détail", async () => {
    checkMock.mockResolvedValue([
      { code: "ASSISTED_MATCHING_DECISION", message: "x", decisionIds: ["d1"] },
      { code: "NO_SOURCE", message: "y" },
      { code: "UNREVIEWED_MATCHING_DECISION", message: "z", decisionIds: ["d2"] },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadMock.mockResolvedValue([{ id: "d1" }, { id: "d2" }] as any);

    const result = await loadBlockingDecisionsForAffair("aff_1");

    expect(loadMock).toHaveBeenCalledWith(["d1", "d2"]);
    expect(result).toHaveLength(2);
  });

  it("ne charge rien quand aucune raison ne porte de décision", async () => {
    checkMock.mockResolvedValue([{ code: "NO_SOURCE", message: "y" }]);

    const result = await loadBlockingDecisionsForAffair("aff_1");

    expect(loadMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
