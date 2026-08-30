import { beforeEach, describe, expect, it, vi } from "vitest";
import { validEvidenceSnapshot } from "./evidence-snapshot-fixture";

const mocks = vi.hoisted(() => ({
  findMeasure: vi.fn(),
  findMeasures: vi.fn(),
  callMistral: vi.fn(),
  extractMistralText: vi.fn(),
  parseMistralJSON: vi.fn(),
  draftMeasureRevision: vi.fn(),
  findAuditLogs: vi.fn(),
  findAuditLog: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    measure: { findUnique: mocks.findMeasure, findMany: mocks.findMeasures },
    auditLog: {
      findMany: mocks.findAuditLogs,
      findFirst: mocks.findAuditLog,
      create: mocks.createAuditLog,
    },
  },
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
    revisions: [],
    ...overrides,
  };
}

describe("génération de contexte sourcé", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMeasure.mockResolvedValue(measure());
    mocks.findAuditLogs.mockResolvedValue([]);
    mocks.findAuditLog.mockResolvedValue(null);
    mocks.createAuditLog.mockResolvedValue({ id: "audit-1" });
    mocks.callMistral.mockResolvedValue({ model: "mistral-small-2506", choices: [] });
    mocks.extractMistralText.mockReturnValue("{}");
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le programme présente cette proposition comme un droit aux vacances. Il part du constat qu’une partie de la population ne part pas en vacances et rattache la mesure à cet enjeu.",
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
          extractorVersion: "mistral-small-2506:measure-context-v6",
          details: expect.stringContaining("droit aux vacances"),
        }),
        generatedContext: expect.objectContaining({
          evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
          promptVersion: "measure-context-v6",
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

  it("transmet au modèle le locuteur et le rôle discursif de chaque preuve", async () => {
    const snapshot = validEvidenceSnapshot();
    const supportingUnit = snapshot.units.find((unit) => unit.unitId === "pdf-13-1-u001");
    if (!supportingUnit) throw new Error("Unité de contexte de test introuvable");
    supportingUnit.speaker = "QUOTED_THIRD_PARTY";
    supportingUnit.discourseRole = "TESTIMONY";
    mocks.findMeasure.mockResolvedValue(
      measure({
        publishedRevision: {
          ...measure().publishedRevision,
          evidenceSnapshot: snapshot,
        },
      })
    );
    const { generateMeasureContextDraft } = await import("../context-generation");

    await generateMeasureContextDraft("measure-1");

    expect(mocks.callMistral).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          content: expect.stringMatching(
            /locuteur="QUOTED_THIRD_PARTY" role-discursif="TESTIMONY"/
          ),
        }),
      ],
      expect.any(Object)
    );
    expect(mocks.callMistral.mock.calls[0]?.[0]?.[0]?.content).toContain(
      "ne doit jamais être attribuée au programme"
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

  it("refuse toute quantité chiffrée dans le contexte automatique", async () => {
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le programme présente cette proposition comme un droit aux vacances destiné à 80 millions de personnes, avec une application générale à toute la population.",
      evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow("contient une quantité");
    expect(mocks.draftMeasureRevision).not.toHaveBeenCalled();
  });

  it("refuse aussi une quantité pourtant présente dans la preuve", async () => {
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le programme présente cette proposition comme un droit destiné à 67 millions de personnes et décrit une partie de la population qui ne part pas en vacances.",
      evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow("contient une quantité");
    expect(mocks.draftMeasureRevision).not.toHaveBeenCalled();
  });

  it("refuse qu'un numéro de proposition justifie une quantité inventée", async () => {
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le programme présente cette proposition comme un droit aux vacances de 2 heures pour toute la population, sans apporter davantage de précisions.",
      evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow("contient une quantité");
    expect(mocks.draftMeasureRevision).not.toHaveBeenCalled();
  });

  it("refuse de réattribuer une quantité à une autre unité", async () => {
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le programme présente cette proposition comme un dispositif qui créerait 1 500 emplois, en s’appuyant sur les éléments de contexte cités.",
      evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow("contient une quantité");
  });

  it("refuse les quantités écrites en lettres", async () => {
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le programme présente cette proposition comme un droit destiné à quatre-vingts millions de personnes, sans apporter d'autre précision.",
      evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow("contient une quantité");
  });

  it.each(["plusieurs milliers d’emplois", "une centaine de bénéficiaires"])(
    "refuse aussi la quantité approximative « %s »",
    async (quantity) => {
      mocks.parseMistralJSON.mockReturnValue({
        details: `Le programme rattache cette proposition à un objectif qui concernerait ${quantity}, sans apporter davantage d'éléments de contexte.`,
        evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
      });
      const { generateMeasureContextDraft } = await import("../context-generation");

      await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow(
        "contient une quantité"
      );
    }
  );

  it("identifie l'historique des contextes avec le même prédicat que la fiche admin", async () => {
    const { hasGeneratedContextHistory } = await import("../context-generation");

    expect(
      hasGeneratedContextHistory([
        { extractionMethod: "AI_ASSISTED", extractorVersion: "mistral:measure-context-v5" },
      ])
    ).toBe(true);
    expect(
      hasGeneratedContextHistory([
        { extractionMethod: "AI_ASSISTED", extractorVersion: "mistral:programme-import-v6" },
      ])
    ).toBe(false);
  });

  it("ne régénère pas un contexte automatique déjà rejeté", async () => {
    mocks.findMeasure.mockResolvedValue(measure({ revisions: [{ id: "revision-rejected" }] }));
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).resolves.toEqual({
      status: "SKIPPED",
      reason: "PREVIOUS_CONTEXT_REJECTED",
    });
    expect(mocks.callMistral).not.toHaveBeenCalled();
  });

  it("ne propose à l'admin que les mesures réellement éligibles", async () => {
    const validEvidence = measure().publishedRevision.evidenceSnapshot;
    mocks.findMeasures.mockResolvedValue([
      {
        id: "measure-invalid",
        latestRevisionId: "revision-1",
        publishedRevisionId: "revision-1",
        publishedRevision: { evidenceSnapshot: null },
        revisions: [],
      },
      {
        id: "measure-draft",
        latestRevisionId: "revision-2",
        publishedRevisionId: "revision-1",
        publishedRevision: { evidenceSnapshot: validEvidence },
        revisions: [],
      },
      {
        id: "measure-rejected",
        latestRevisionId: "revision-1",
        publishedRevisionId: "revision-1",
        publishedRevision: { evidenceSnapshot: validEvidence },
        revisions: [{ id: "revision-rejected" }],
      },
      {
        id: "measure-eligible",
        latestRevisionId: "revision-1",
        publishedRevisionId: "revision-1",
        publishedRevision: { evidenceSnapshot: validEvidence },
        revisions: [],
      },
    ]);
    const { filterMeasureContextCandidateIds } = await import("../context-generation");

    await expect(
      filterMeasureContextCandidateIds(["measure-invalid", "measure-draft", "measure-eligible"], 10)
    ).resolves.toEqual(["measure-eligible"]);
  });

  it("pagine au-delà des premières mesures inéligibles", async () => {
    const ineligible = (id: string) => ({
      id,
      latestRevisionId: `${id}-draft`,
      publishedRevisionId: `${id}-published`,
      publishedRevision: { evidenceSnapshot: validEvidenceSnapshot() },
      revisions: [],
    });
    const eligible = (id: string) => ({
      id,
      latestRevisionId: `${id}-published`,
      publishedRevisionId: `${id}-published`,
      publishedRevision: { evidenceSnapshot: validEvidenceSnapshot() },
      revisions: [],
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
    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "GENERATE_CONTEXT_TERMINAL_RESULT",
        entityType: "MeasureRevision",
        entityId: "revision-1",
      }),
    });
  });

  it("ne relance pas Mistral après un résultat sans contexte utile sur la même révision", async () => {
    mocks.findAuditLog.mockResolvedValue({ id: "audit-previous-attempt" });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).resolves.toEqual({
      status: "SKIPPED",
      reason: "PREVIOUS_CONTEXT_ATTEMPT",
    });
    expect(mocks.callMistral).not.toHaveBeenCalled();
  });

  it("exclut des lots une révision déjà jugée sans contexte utile", async () => {
    const candidate = {
      id: "measure-terminal",
      latestRevisionId: "revision-terminal",
      publishedRevisionId: "revision-terminal",
      publishedRevision: { evidenceSnapshot: validEvidenceSnapshot() },
      revisions: [],
    };
    mocks.findMeasures.mockResolvedValue([candidate]);
    mocks.findAuditLogs.mockResolvedValue([{ entityId: "revision-terminal" }]);
    const { filterMeasureContextCandidateIds } = await import("../context-generation");

    await expect(filterMeasureContextCandidateIds(["measure-terminal"])).resolves.toEqual([]);
  });

  it("refuse une trace qui omet une unité fournie au modèle", async () => {
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le programme présente cette proposition comme un droit aux vacances et la rattache au constat qu'une partie de la population ne part pas.",
      evidenceUnitIds: ["pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow(
      "l'ensemble exact des preuves"
    );
    expect(mocks.draftMeasureRevision).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "GENERATE_CONTEXT_TERMINAL_RESULT",
        changes: expect.objectContaining({ outcome: "INVALID_GENERATED_CONTEXT" }),
      }),
    });
  });

  it("trace une réponse JSON invalide avant de remonter l'erreur", async () => {
    mocks.parseMistralJSON.mockImplementationOnce(() => {
      throw new SyntaxError("Invalid JSON");
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow(
      "ne respecte pas le format attendu"
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changes: expect.objectContaining({ outcome: "INVALID_GENERATED_CONTEXT" }),
      }),
    });
  });

  it.each([
    "Le programme ne prévoit zéro bénéficiaire dans les territoires concernés.",
    "Le programme ne prévoit aucun bénéficiaire dans les territoires concernés.",
    "Le programme vise un bénéficiaire dans chaque territoire concerné par la mesure.",
    "Le programme vise une personne dans chaque territoire concerné par la mesure.",
    "Le programme présente la moitié des Français comme concernés par cette mesure.",
  ])("refuse la quantité singulière ou accentuée dans « %s »", async (details) => {
    mocks.parseMistralJSON.mockReturnValue({
      details: `${details} Il rattache cette proposition au contexte décrit dans le document source.`,
      evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).rejects.toThrow("contient une quantité");
    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changes: expect.objectContaining({ outcome: "INVALID_GENERATED_CONTEXT" }),
      }),
    });
  });
});
