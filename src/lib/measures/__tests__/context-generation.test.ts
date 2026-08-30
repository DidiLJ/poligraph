import { beforeEach, describe, expect, it, vi } from "vitest";
import { validEvidenceSnapshot } from "./evidence-snapshot-fixture";

const mocks = vi.hoisted(() => ({
  findMeasure: vi.fn(),
  findMeasures: vi.fn(),
  callMistral: vi.fn(),
  extractMistralText: vi.fn(),
  parseMistralJSON: vi.fn(),
  draftMeasureRevision: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { measure: { findUnique: mocks.findMeasure, findMany: mocks.findMeasures } },
}));
vi.mock("@/lib/api/mistral", () => ({
  callMistral: mocks.callMistral,
  extractMistralText: mocks.extractMistralText,
  parseMistralJSON: mocks.parseMistralJSON,
}));
vi.mock("@/lib/measures/transitions", () => ({
  draftMeasureRevision: mocks.draftMeasureRevision,
}));

function measure(overrides: Record<string, unknown> = {}) {
  return {
    id: "measure-1",
    updatedAt: new Date("2026-08-30T00:00:00Z"),
    latestRevisionId: "revision-1",
    publishedRevisionId: "revision-1",
    publishedRevision: {
      id: "revision-1",
      text: "Créer un droit aux vacances.",
      details: null,
      precision: "OBJECTIF_SANS_CHIFFRE",
      validFrom: new Date("2026-08-01T00:00:00Z"),
      evidenceSnapshot: validEvidenceSnapshot(),
    },
    ...overrides,
  };
}

describe("génération de contexte sourcé", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMeasure.mockResolvedValue(measure());
    mocks.callMistral.mockResolvedValue({ model: "mistral-small-2506", choices: [] });
    mocks.extractMistralText.mockReturnValue("{}");
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le programme présente cette proposition comme un droit aux vacances destiné à 67 millions de personnes. Il part du constat qu’une partie de la population ne part pas en vacances.",
      evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
    });
    mocks.draftMeasureRevision.mockResolvedValue({ revisionId: "revision-2" });
  });

  it("crée un brouillon IA en conservant la preuve et une trace des unités citées", async () => {
    const { generateMeasureContextDraft } = await import("../context-generation");

    const result = await generateMeasureContextDraft("measure-1", { generatedBy: "admin" });

    expect(result.status).toBe("CREATED");
    expect(mocks.draftMeasureRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        measureId: "measure-1",
        preserveEvidenceFromRevisionId: "revision-1",
        revision: expect.objectContaining({
          extractionMethod: "AI_ASSISTED",
          extractorVersion: "mistral-small-2506:measure-context-v2",
          details: expect.stringContaining("67 millions"),
        }),
        generatedContext: expect.objectContaining({
          evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
          promptVersion: "measure-context-v2",
        }),
      })
    );
    expect(mocks.callMistral).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          content: expect.stringContaining(
            "ne présente jamais l'argumentaire du programme comme un fait établi"
          ),
        }),
      ],
      expect.any(Object)
    );
  });

  it("ne remplace jamais un brouillon éditorial déjà actif", async () => {
    mocks.findMeasure.mockResolvedValue(measure({ latestRevisionId: "revision-human-draft" }));
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).resolves.toEqual({
      status: "SKIPPED",
      reason: "ACTIVE_DRAFT",
    });
    expect(mocks.callMistral).not.toHaveBeenCalled();
  });

  it("refuse de générer sans contexte explicite dans la preuve", async () => {
    const snapshot = validEvidenceSnapshot();
    snapshot.supportingIds = [];
    snapshot.units = snapshot.units.filter((unit) => unit.role === "COMMITMENT_ANCHOR");
    snapshot.canonicalEvidenceHash = "invalidated-by-fixture-change";
    mocks.findMeasure.mockResolvedValue(
      measure({
        publishedRevision: {
          ...measure().publishedRevision,
          evidenceSnapshot: null,
        },
      })
    );
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).resolves.toEqual({
      status: "SKIPPED",
      reason: "NO_VALID_EVIDENCE",
    });
    expect(mocks.callMistral).not.toHaveBeenCalled();
  });

  it("refuse un nombre absent des unités de preuve", async () => {
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le programme présente cette proposition comme un droit aux vacances destiné à 80 millions de personnes, avec une application générale à toute la population.",
      evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow(
      "nombre absent de la preuve"
    );
    expect(mocks.draftMeasureRevision).not.toHaveBeenCalled();
  });

  it("refuse un nombre présent seulement dans une unité non citée", async () => {
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le programme présente cette proposition comme un droit destiné à 67 millions de personnes et décrit une partie de la population qui ne part pas en vacances.",
      evidenceUnitIds: ["pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow(
      "nombre absent de la preuve"
    );
    expect(mocks.draftMeasureRevision).not.toHaveBeenCalled();
  });

  it("pagine au-delà des premières mesures inéligibles", async () => {
    const ineligible = (id: string) => ({
      id,
      latestRevisionId: `${id}-draft`,
      publishedRevisionId: `${id}-published`,
      publishedRevision: { evidenceSnapshot: validEvidenceSnapshot() },
    });
    const eligible = (id: string) => ({
      id,
      latestRevisionId: `${id}-published`,
      publishedRevisionId: `${id}-published`,
      publishedRevision: { evidenceSnapshot: validEvidenceSnapshot() },
    });
    mocks.findMeasures
      .mockResolvedValueOnce([ineligible("measure-1"), ineligible("measure-2")])
      .mockResolvedValueOnce([eligible("measure-3")]);
    const { findMeasureContextCandidateIds } = await import("../context-generation");

    await expect(findMeasureContextCandidateIds("presidentielle-2027", 1, 2)).resolves.toEqual([
      "measure-3",
    ]);
    expect(mocks.findMeasures).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: { id: "measure-2" }, skip: 1 })
    );
  });

  it("accepte que le modèle juge le contexte insuffisant sans créer de brouillon", async () => {
    mocks.parseMistralJSON.mockReturnValue({ details: null, evidenceUnitIds: [] });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).resolves.toEqual({
      status: "SKIPPED",
      reason: "NO_USEFUL_CONTEXT",
    });
    expect(mocks.draftMeasureRevision).not.toHaveBeenCalled();
  });
});
