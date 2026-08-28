import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRevision: vi.fn(),
  callAnthropic: vi.fn(),
  extractToolUse: vi.fn(),
  transaction: vi.fn(),
  upsertSubtopic: vi.fn(),
  findSubtopics: vi.fn(),
  findAuditLogs: vi.fn(),
  findAssignment: vi.fn(),
  updateAssignments: vi.fn(),
  deleteAssignments: vi.fn(),
  createAssignments: vi.fn(),
  createAudit: vi.fn(),
  invalidateMeasureTags: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    measureRevision: { findUnique: mocks.findRevision },
    measureSubtopic: {
      upsert: mocks.upsertSubtopic,
      findMany: mocks.findSubtopics,
    },
    auditLog: { findMany: mocks.findAuditLogs },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/api/anthropic", () => ({
  callAnthropic: mocks.callAnthropic,
  extractToolUse: mocks.extractToolUse,
}));
vi.mock("@/lib/measures/cache", () => ({
  invalidateMeasureTags: mocks.invalidateMeasureTags,
}));

const transactionClient = {
  measureRevisionSubtopic: {
    findUnique: mocks.findAssignment,
    updateMany: mocks.updateAssignments,
    deleteMany: mocks.deleteAssignments,
    createMany: mocks.createAssignments,
  },
  auditLog: { create: mocks.createAudit },
};

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
    mocks.findAuditLogs.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
    mocks.findSubtopics.mockResolvedValue([]);
    mocks.deleteAssignments.mockResolvedValue({ count: 0 });
    mocks.createAssignments.mockResolvedValue({ count: 0 });
    mocks.createAudit.mockResolvedValue({ id: "audit-1" });
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

  it("mémorise aussi une classification sans suggestion", async () => {
    mocks.extractToolUse.mockReturnValue({ subtopics: [] });
    const { proposeMeasureRevisionSubtopics } = await import("../subtopics");
    const result = await proposeMeasureRevisionSubtopics("revision-1", {
      skipTaxonomySync: true,
    });

    expect(result.suggestions).toEqual([]);
    expect(mocks.createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "PROPOSE_SUBTOPICS",
        entityId: "revision-1",
        changes: expect.objectContaining({ slugs: [] }),
      }),
    });
  });

  it("retrouve les révisions déjà classées à partir du journal d'audit", async () => {
    mocks.findAuditLogs.mockResolvedValue([{ entityId: "revision-1" }, { entityId: "revision-2" }]);
    const { getPreviouslyClassifiedMeasureRevisionIds } = await import("../subtopics");

    await expect(getPreviouslyClassifiedMeasureRevisionIds()).resolves.toEqual([
      "revision-1",
      "revision-2",
    ]);
    expect(mocks.findAuditLogs).toHaveBeenCalledWith({
      where: { action: "PROPOSE_SUBTOPICS", entityType: "MeasureRevision" },
      select: { entityId: true },
      distinct: ["entityId"],
    });
  });

  it("refuse qu'une décision concurrente écrase la première", async () => {
    mocks.findAssignment.mockResolvedValue({
      status: "SUGGESTED",
      revision: { measure: { id: "measure-1", electionId: "election-1" } },
    });
    mocks.updateAssignments.mockResolvedValue({ count: 0 });
    const { reviewMeasureRevisionSubtopic } = await import("../subtopics");

    await expect(
      reviewMeasureRevisionSubtopic({
        revisionId: "revision-1",
        subtopicId: "subtopic-1",
        status: "APPROVED",
        reviewedBy: "admin",
      })
    ).rejects.toThrow("déjà été traitée");
    expect(mocks.createAudit).not.toHaveBeenCalled();
    expect(mocks.invalidateMeasureTags).not.toHaveBeenCalled();
  });

  it("invalide les caches publics après une décision humaine", async () => {
    mocks.findAssignment.mockResolvedValue({
      status: "SUGGESTED",
      revision: { measure: { id: "measure-1", electionId: "election-1" } },
    });
    mocks.updateAssignments.mockResolvedValue({ count: 1 });
    const { reviewMeasureRevisionSubtopic } = await import("../subtopics");

    await reviewMeasureRevisionSubtopic({
      revisionId: "revision-1",
      subtopicId: "subtopic-1",
      status: "APPROVED",
      reviewedBy: "admin",
    });

    expect(mocks.invalidateMeasureTags).toHaveBeenCalledWith("measure-1", "election-1");
  });
});
