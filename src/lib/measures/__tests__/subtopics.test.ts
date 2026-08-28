import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRevision: vi.fn(),
  callAnthropic: vi.fn(),
  extractToolUse: vi.fn(),
  transaction: vi.fn(),
  upsertSubtopic: vi.fn(),
  findSubtopics: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    measureRevision: { findUnique: mocks.findRevision },
    measureSubtopic: {
      upsert: mocks.upsertSubtopic,
      findMany: mocks.findSubtopics,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/api/anthropic", () => ({
  callAnthropic: mocks.callAnthropic,
  extractToolUse: mocks.extractToolUse,
}));

describe("classification des sous-sujets de mesure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findRevision.mockResolvedValue({
      id: "revision-1",
      text: 'Encadrer les "loyers"\ndans les zones tendues.',
      measure: { theme: "LOGEMENT_URBANISME" },
      subtopics: [],
    });
    mocks.callAnthropic.mockResolvedValue({ content: [] });
    mocks.extractToolUse.mockReturnValue({
      subtopics: [
        { slug: "loyers", confidence: 0.94 },
        { slug: "hors-taxonomie", confidence: 1 },
      ],
    });
  });

  it("reste dans la taxonomie fermée et ne fait aucune écriture en simulation", async () => {
    const { proposeMeasureRevisionSubtopics } = await import("../subtopics");
    const result = await proposeMeasureRevisionSubtopics("revision-1", { dryRun: true });

    expect(result.suggestions).toEqual([{ slug: "loyers", confidence: 0.94 }]);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.upsertSubtopic).not.toHaveBeenCalled();
  });

  it("nettoie le texte avant de l'insérer dans le prompt", async () => {
    const { proposeMeasureRevisionSubtopics } = await import("../subtopics");
    await proposeMeasureRevisionSubtopics("revision-1", { dryRun: true });

    const messages = mocks.callAnthropic.mock.calls[0]?.[0] as Array<{ content: string }>;
    expect(messages[0]?.content).toContain("Encadrer les loyers dans les zones tendues.");
    expect(messages[0]?.content).not.toContain('"loyers"');
  });

  it("préserve une validation humaine sans rappeler le modèle", async () => {
    mocks.findRevision.mockResolvedValue({
      id: "revision-1",
      text: "Encadrer les loyers.",
      measure: { theme: "LOGEMENT_URBANISME" },
      subtopics: [{ subtopic: { slug: "loyers" }, status: "APPROVED" }],
    });
    const { proposeMeasureRevisionSubtopics } = await import("../subtopics");
    const result = await proposeMeasureRevisionSubtopics("revision-1");

    expect(result.skipped).toBe(true);
    expect(mocks.callAnthropic).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
