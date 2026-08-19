import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: {
    affair: { findUnique: vi.fn(), update: vi.fn() },
    affairUpdateProposal: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  verifyAndAnnotateProposalOfficialEvidence: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/affairs/official-decision-verification", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/affairs/official-decision-verification")>();
  return {
    ...actual,
    verifyAndAnnotateProposalOfficialEvidence: h.verifyAndAnnotateProposalOfficialEvidence,
  };
});

import { proposeAffairUpdate } from "../proposals";

const INITIAL_URL = "https://www.legifrance.gouv.fr/juri/id/JURITEXT000049774995";
const NORMALIZED_URL = "https://legifrance.gouv.fr/juri/id/JURITEXT000049774995";
const DECISION_BODY = "N° 23-82.194 ECLI:FR:CCASS:2024:CR00817 19 JUIN 2024 REJET";

function response(
  body: string,
  init: { status?: number; url?: string; headers?: HeadersInit } = {}
): Response {
  const status = init.status ?? 200;
  return {
    status,
    ok: status >= 200 && status < 300,
    url: init.url ?? INITIAL_URL,
    headers: new Headers(init.headers),
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("official evidence on proposal creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.db.affair.findUnique.mockResolvedValue({
      id: "affair-1",
      slug: "affair-1",
      publicId: null,
      title: "Affaire test",
      politician: { slug: "personne", fullName: "Personne" },
      status: "CONDAMNATION_DEFINITIVE",
      verdictDate: null,
      court: null,
      sentence: null,
      prisonMonths: null,
      prisonFirmMonths: null,
      fineAmount: null,
      ineligibilityMonths: null,
      ineligibilityFirmMonths: null,
      communityService: null,
      otherSentence: null,
    });
    h.db.affairUpdateProposal.findFirst.mockResolvedValue(null);
    h.db.affairUpdateProposal.create.mockResolvedValue({ id: "proposal-v2" });
    h.verifyAndAnnotateProposalOfficialEvidence.mockResolvedValue(null);
  });

  it("stores the canonical URL, verification metadata and live content hash", async () => {
    const canonicalUrl = "https://www.legifrance.gouv.fr/juri/id/JURITEXT000049774995";
    h.verifyAndAnnotateProposalOfficialEvidence.mockResolvedValue({
      sourceUrl: canonicalUrl,
      metadata: {
        courtDecisionCandidate: {
          canonicalUrl,
          verification: { status: "VALID" },
        },
      },
      verification: {
        version: 1,
        status: "VALID",
        checkedAt: "2026-08-18T09:00:00.000Z",
        requestedUrl: canonicalUrl,
        resolvedUrl: canonicalUrl,
        httpStatus: 200,
        contentHash: "a".repeat(64),
        matchedIdentifiers: ["officialId", "pourvoi", "decisionDate"],
        issues: [],
        indexedProof: null,
      },
    });

    await proposeAffairUpdate({
      affairId: "affair-1",
      importer: "test",
      importRunId: "run-1",
      patch: { fineAmount: "50000.00" },
      source: "LEGIFRANCE",
      sourceUrl: `${canonicalUrl}/`,
      officialId: "23-82.194",
      metadata: {
        courtDecisionCandidate: {
          url: `${canonicalUrl}/`,
          pourvoi: "23-82.194",
        },
      },
      confidence: 99,
      rationale: "Décision officielle identifiée.",
    });

    expect(h.db.affairUpdateProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceUrl: canonicalUrl,
          sourceContentHash: "a".repeat(64),
          observedValues: { fineAmount: null },
          metadata: expect.objectContaining({
            courtDecisionCandidate: expect.objectContaining({
              verification: { status: "VALID" },
            }),
          }),
        }),
        select: { id: true },
      })
    );
  });

  it("stores the final URL as VALID after a bounded direct redirect verification", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/affairs/official-decision-verification")
    >("@/lib/affairs/official-decision-verification");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 302, headers: { location: NORMALIZED_URL } }))
      .mockResolvedValueOnce(response(DECISION_BODY, { url: NORMALIZED_URL }))
      .mockResolvedValueOnce(response(DECISION_BODY, { url: NORMALIZED_URL }));
    h.verifyAndAnnotateProposalOfficialEvidence.mockImplementation((input) =>
      actual.verifyAndAnnotateProposalOfficialEvidence(input, { fetchImpl })
    );

    await proposeAffairUpdate({
      affairId: "affair-1",
      importer: "test",
      importRunId: "run-redirect",
      patch: { fineAmount: "50000.00" },
      source: "LEGIFRANCE",
      sourceUrl: INITIAL_URL,
      officialId: "JURITEXT000049774995",
      metadata: {
        courtDecisionCandidate: {
          url: INITIAL_URL,
          pourvoi: "23-82.194",
          ecli: "FR:CCASS:2024:CR00817",
          date: "2024-06-19",
          legifranceId: "JURITEXT000049774995",
        },
      },
      confidence: 99,
      rationale: "Décision officielle redirigée vers son URL canonique.",
    });

    const created = h.db.affairUpdateProposal.create.mock.calls[0]![0].data;
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(created.sourceUrl).toBe(NORMALIZED_URL);
    expect(created.metadata).toMatchObject({
      courtDecisionCandidate: {
        canonicalUrl: NORMALIZED_URL,
        verification: { status: "VALID" },
        urlNormalization: {
          initialUrl: INITIAL_URL,
          finalUrl: NORMALIZED_URL,
          reason: "OFFICIAL_REDIRECT",
        },
      },
    });
    expect(h.db.affair.update).not.toHaveBeenCalled();
  });

  it.each([
    [
      "MISMATCH",
      response("N° 23-82.999 ECLI:FR:CCASS:2024:CR00999 20 JUIN 2024", {
        url: NORMALIZED_URL,
      }),
    ],
    ["BLOCKED", response("Forbidden", { status: 403, url: NORMALIZED_URL })],
  ])(
    "does not create a proposal when direct verification after a redirect is %s",
    async (expectedStatus, finalResponse) => {
      const actual = await vi.importActual<
        typeof import("@/lib/affairs/official-decision-verification")
      >("@/lib/affairs/official-decision-verification");
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(response("", { status: 302, headers: { location: NORMALIZED_URL } }))
        .mockResolvedValueOnce(response(DECISION_BODY, { url: NORMALIZED_URL }))
        .mockResolvedValueOnce(finalResponse);
      h.verifyAndAnnotateProposalOfficialEvidence.mockImplementation((input) =>
        actual.verifyAndAnnotateProposalOfficialEvidence(input, { fetchImpl })
      );

      await expect(
        proposeAffairUpdate({
          affairId: "affair-1",
          importer: "test",
          importRunId: `run-redirect-${expectedStatus}`,
          patch: { fineAmount: "50000.00" },
          source: "LEGIFRANCE",
          sourceUrl: INITIAL_URL,
          officialId: "JURITEXT000049774995",
          metadata: {
            courtDecisionCandidate: {
              url: INITIAL_URL,
              pourvoi: "23-82.194",
              ecli: "FR:CCASS:2024:CR00817",
              date: "2024-06-19",
              legifranceId: "JURITEXT000049774995",
            },
          },
          confidence: 99,
          rationale: "Décision officielle redirigée vers son URL canonique.",
        })
      ).rejects.toMatchObject({ verification: { status: expectedStatus } });

      expect(fetchImpl).toHaveBeenCalledTimes(3);
      expect(h.db.affair.findUnique).not.toHaveBeenCalled();
      expect(h.db.affairUpdateProposal.create).not.toHaveBeenCalled();
      expect(h.db.affair.update).not.toHaveBeenCalled();
    }
  );

  it("does not query or write when evidence verification fails", async () => {
    h.verifyAndAnnotateProposalOfficialEvidence.mockRejectedValue(
      new Error("La décision officielle n'est pas vérifiée (MISMATCH)")
    );

    await expect(
      proposeAffairUpdate({
        affairId: "affair-1",
        importer: "test",
        importRunId: "run-1",
        patch: { court: "Cour de cassation" },
        source: "LEGIFRANCE",
        sourceUrl: "https://www.legifrance.gouv.fr/juri/id/JURITEXT000049774995",
        confidence: 99,
        rationale: "Décision officielle supposée.",
      })
    ).rejects.toThrow("MISMATCH");

    expect(h.db.affair.findUnique).not.toHaveBeenCalled();
    expect(h.db.affairUpdateProposal.create).not.toHaveBeenCalled();
  });

  it("does not construct an official URL when identifiers are present without a URL", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/affairs/official-decision-verification")
    >("@/lib/affairs/official-decision-verification");
    h.verifyAndAnnotateProposalOfficialEvidence.mockImplementation((input) =>
      actual.verifyAndAnnotateProposalOfficialEvidence(input)
    );

    await expect(
      proposeAffairUpdate({
        affairId: "affair-1",
        importer: "test",
        importRunId: "run-1",
        patch: { court: "Cour de cassation" },
        source: "LEGIFRANCE",
        officialId: "JURITEXT000049774995",
        metadata: {
          courtDecisionCandidate: {
            pourvoi: "23-82.194",
            ecli: "FR:CCASS:2024:CR00817",
            date: "2024-06-19",
            legifranceId: "JURITEXT000049774995",
          },
        },
        confidence: 99,
        rationale: "Identifiants officiels sans URL vérifiable.",
      })
    ).rejects.toThrow("UNCHECKED");

    expect(h.verifyAndAnnotateProposalOfficialEvidence.mock.calls[0]![0].sourceUrl).toBeUndefined();
    expect(h.db.affair.findUnique).not.toHaveBeenCalled();
    expect(h.db.affairUpdateProposal.create).not.toHaveBeenCalled();
  });
});
