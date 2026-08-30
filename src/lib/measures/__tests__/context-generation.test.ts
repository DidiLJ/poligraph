import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MeasureConcurrencyError } from "@/lib/measures/errors";
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
  findMeasureForUpdate: vi.fn(),
  updateMeasure: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    measure: { findUnique: mocks.findMeasure, findMany: mocks.findMeasures },
    auditLog: {
      findMany: mocks.findAuditLogs,
      findFirst: mocks.findAuditLog,
      create: mocks.createAuditLog,
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        measure: {
          findUniqueOrThrow: mocks.findMeasureForUpdate,
          update: mocks.updateMeasure,
        },
        auditLog: { create: mocks.createAuditLog },
      })
    ),
  },
}));
vi.mock("@/lib/measures/lock", () => ({ lockMeasure: vi.fn(async () => undefined) }));
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
    mocks.findMeasureForUpdate.mockResolvedValue({
      latestRevisionId: "revision-1",
      publishedRevisionId: "revision-1",
      updatedAt: new Date("2026-08-30T00:00:00Z"),
    });
    mocks.findAuditLogs.mockResolvedValue([]);
    mocks.findAuditLog.mockResolvedValue(null);
    mocks.createAuditLog.mockResolvedValue({ id: "audit-1" });
    mocks.updateMeasure.mockResolvedValue({ id: "measure-1" });
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

    const result = await generateMeasureContextDraft("measure-1", {
      generatedBy: "admin",
      ipAddress: "203.0.113.8",
      userAgent: "vitest-agent",
    });

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
          ipAddress: "203.0.113.8",
          promptVersion: "measure-context-v6",
          userAgent: "vitest-agent",
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

  it("borne chaque extrait de preuve avant son interpolation dans le prompt", async () => {
    const snapshot = validEvidenceSnapshot();
    const supportingUnit = snapshot.units.find((unit) => unit.unitId === "pdf-13-1-u001");
    if (!supportingUnit) throw new Error("Unité de contexte de test introuvable");
    supportingUnit.rawExactText = `${"A".repeat(220)}INSTRUCTION_A_IGNORER`;
    supportingUnit.rawTextHash = createHash("sha256")
      .update(supportingUnit.rawExactText, "utf8")
      .digest("hex");
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

    expect(mocks.callMistral).toHaveBeenCalledOnce();
    const prompt = mocks.callMistral.mock.calls[0]?.[0]?.[0]?.content;
    expect(prompt).toContain("A".repeat(200));
    expect(prompt).not.toContain("INSTRUCTION_A_IGNORER");
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

  it("refuse une version déjà obsolète avant tout appel Mistral", async () => {
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(
      generateMeasureContextDraft("measure-1", {
        expectedUpdatedAt: new Date("2026-08-29T23:59:00Z"),
      })
    ).rejects.toBeInstanceOf(MeasureConcurrencyError);
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

  it("cherche l'historique du contexte sur la révision publiée uniquement", async () => {
    mocks.findAuditLog.mockResolvedValue({ id: "audit-context" });
    const { hasContextAttemptForRevision } = await import("../context-generation");

    await expect(hasContextAttemptForRevision("revision-published")).resolves.toBe(true);
    expect(mocks.findAuditLog).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({
            action: "GENERATE_CONTEXT_DRAFT",
            changes: { path: ["previousRevisionId"], equals: "revision-published" },
          }),
        ]),
      }),
      select: { id: true },
    });
  });

  it("ne régénère pas un contexte automatique déjà rejeté", async () => {
    mocks.findAuditLog.mockResolvedValue({ id: "audit-rejected-context" });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).resolves.toEqual({
      status: "SKIPPED",
      reason: "PREVIOUS_CONTEXT_ATTEMPT",
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

  it("refuse de tracer une issue terminale à partir d'une version devenue obsolète", async () => {
    mocks.parseMistralJSON.mockReturnValue({ details: null, evidenceUnitIds: [] });
    mocks.findMeasureForUpdate.mockResolvedValue({
      latestRevisionId: "revision-1",
      publishedRevisionId: "revision-1",
      updatedAt: new Date("2026-08-30T00:01:00Z"),
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(
      generateMeasureContextDraft("measure-1", {
        expectedUpdatedAt: new Date("2026-08-30T00:00:00Z"),
      })
    ).rejects.toBeInstanceOf(MeasureConcurrencyError);
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
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
    mocks.findAuditLogs.mockResolvedValue([
      {
        action: "GENERATE_CONTEXT_TERMINAL_RESULT",
        changes: null,
        entityId: "revision-terminal",
      },
    ]);
    const { filterMeasureContextCandidateIds } = await import("../context-generation");

    await expect(filterMeasureContextCandidateIds(["measure-terminal"])).resolves.toEqual([]);
  });

  it("réautorise une nouvelle révision publiée après un ancien contexte généré", async () => {
    mocks.findMeasures.mockResolvedValue([
      {
        id: "measure-fresh",
        latestRevisionId: "revision-fresh",
        publishedRevisionId: "revision-fresh",
        publishedRevision: { evidenceSnapshot: validEvidenceSnapshot() },
      },
    ]);
    mocks.findAuditLogs.mockResolvedValue([
      {
        action: "GENERATE_CONTEXT_DRAFT",
        changes: { previousRevisionId: "revision-old" },
        entityId: "revision-generated-old",
      },
    ]);
    const { filterMeasureContextCandidateIds } = await import("../context-generation");

    await expect(filterMeasureContextCandidateIds(["measure-fresh"])).resolves.toEqual([
      "measure-fresh",
    ]);
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
    "Le programme vise mille bénéficiaires dans les territoires concernés.",
    "Le programme ne prévoit aucun bénéficiaire dans les territoires concernés.",
    "Le programme vise un bénéficiaire dans chaque territoire concerné par la mesure.",
    "Le programme vise une personne dans chaque territoire concerné par la mesure.",
    "Le programme présente la moitié des Français comme concernés par cette mesure.",
    "Le programme prévoit une première phase consacrée à ce dispositif.",
    "Le programme prévoit un deuxième pilier consacré à ce dispositif.",
    "Le programme prévoit un troisième trimestre consacré à ce dispositif.",
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

  it("accepte l'attribution des propos à un tiers sans la confondre avec une fraction", async () => {
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le document rapporte les propos d'un tiers et les distingue de la position défendue par le programme dans cette proposition.",
      evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).resolves.toMatchObject({
      status: "CREATED",
    });
  });

  it("accepte le titre de Première ministre sans le confondre avec un ordinal", async () => {
    mocks.parseMistralJSON.mockReturnValue({
      details:
        "Le document attribue cette proposition à la Première ministre et la présente comme une orientation défendue par le programme.",
      evidenceUnitIds: ["pdf-12-2-u001", "pdf-13-1-u001"],
    });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await expect(generateMeasureContextDraft("measure-1")).resolves.toMatchObject({
      status: "CREATED",
    });
  });

  it("invalide le jeton de version avec l'issue terminale", async () => {
    mocks.parseMistralJSON.mockReturnValue({ details: null, evidenceUnitIds: [] });
    const { generateMeasureContextDraft } = await import("../context-generation");

    await generateMeasureContextDraft("measure-1");

    expect(mocks.updateMeasure).toHaveBeenCalledWith({
      where: { id: "measure-1" },
      data: { updatedAt: expect.any(Date) },
    });
  });
});
