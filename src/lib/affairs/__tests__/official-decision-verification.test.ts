import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAcceptableOfficialDecisionVerification,
  summarizeProposalOfficialEvidence,
  verifyOfficialDecision,
  verifyProposalOfficialEvidence,
  type OfficialDecisionIndexedProof,
} from "../official-decision-verification";

const URL = "https://www.legifrance.gouv.fr/juri/id/JURITEXT000049774995";

function response(
  body: string,
  init: { status?: number; url?: string; headers?: HeadersInit } = {}
): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    url: init.url ?? URL,
    headers: new Headers(init.headers),
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function expectation() {
  return {
    url: URL,
    pourvoi: "23-82.194",
    ecli: "FR:CCASS:2024:CR00817",
    decisionDate: "2024-06-19",
    officialId: "JURITEXT000049774995",
  };
}

function indexedProof(
  overrides: Partial<OfficialDecisionIndexedProof> = {}
): OfficialDecisionIndexedProof {
  return {
    version: 1,
    exactUrl: URL,
    verifiedAt: "2026-08-18T08:00:00.000Z",
    method: "EXACT_OFFICIAL_SEARCH_RESULT",
    title: "Cour de cassation, Chambre criminelle, 19 juin 2024, 23-82.194, publié au bulletin",
    publisher: "Légifrance",
    pourvoi: "23-82.194",
    ecli: "FR:CCASS:2024:CR00817",
    decisionDate: "2024-06-19",
    officialId: "JURITEXT000049774995",
    ...overrides,
  };
}

describe("official decision verification", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("validates the URL, pourvoi, ECLI, date and official identifier together", async () => {
    const result = await verifyOfficialDecision(expectation(), {
      fetchImpl: vi
        .fn()
        .mockResolvedValue(response("N° 23-82.194 ECLI:FR:CCASS:2024:CR00817 19 JUIN 2024 REJET")),
    });

    expect(result.status).toBe("VALID");
    expect(result.matchedIdentifiers).toEqual(["officialId", "pourvoi", "ecli", "decisionDate"]);
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(isAcceptableOfficialDecisionVerification(result)).toBe(true);
  });

  it("rejects a canonical URL whose official identifier differs", async () => {
    const fetchImpl = vi.fn();
    const result = await verifyOfficialDecision(
      { ...expectation(), officialId: "JURITEXT000049774999" },
      { fetchImpl }
    );

    expect(result.status).toBe("UNCHECKED");
    expect(result.issues).toContain("url_et_identifiant_officiel_differents");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a reachable page for another decision", async () => {
    const result = await verifyOfficialDecision(expectation(), {
      fetchImpl: vi
        .fn()
        .mockResolvedValue(response("N° 23-82.999 ECLI:FR:CCASS:2024:CR00999 20 JUIN 2024")),
    });

    expect(result.status).toBe("MISMATCH");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "pourvoi_absent_ou_different",
        "ecli_absent_ou_different",
        "date_decision_absente_ou_differente",
      ])
    );
  });

  it("does not accept identifiers hidden in malformed script markup", async () => {
    const result = await verifyOfficialDecision(expectation(), {
      fetchImpl: vi
        .fn()
        .mockResolvedValue(
          response(
            "<script>N° 23-82.194 ECLI:FR:CCASS:2024:CR00817 19 JUIN 2024</script > N° 23-82.999"
          )
        ),
    });

    expect(result.status).toBe("MISMATCH");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "pourvoi_absent_ou_different",
        "ecli_absent_ou_different",
        "date_decision_absente_ou_differente",
      ])
    );
  });

  it("classifies missing pages as broken without using an indexed fallback", async () => {
    const result = await verifyOfficialDecision(
      { ...expectation(), indexedProof: indexedProof() },
      { fetchImpl: vi.fn().mockResolvedValue(response("Not found", { status: 404 })) }
    );

    expect(result.status).toBe("BROKEN");
    expect(isAcceptableOfficialDecisionVerification(result)).toBe(false);
  });

  it("fails closed when the official response body cannot be read", async () => {
    const unreadable = response("");
    unreadable.text = vi.fn().mockRejectedValue(new Error("stream failure"));
    const result = await verifyOfficialDecision(expectation(), {
      fetchImpl: vi.fn().mockResolvedValue(unreadable),
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.issues).toContain("lecture_reponse_impossible");
  });

  it("refuses non-official hosts before any network request", async () => {
    const fetchImpl = vi.fn();
    const result = await verifyOfficialDecision(
      { ...expectation(), url: "https://example.test/juri/id/JURITEXT000049774995" },
      { fetchImpl }
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.issues).toContain("hote_officiel_non_autorise");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not follow a redirect to an unapproved host", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response("", {
        status: 302,
        headers: { location: "http://127.0.0.1/private" },
      })
    );
    const result = await verifyOfficialDecision(expectation(), { fetchImpl });

    expect(result.status).toBe("BLOCKED");
    expect(result.issues[0]).toContain("redirection_non_autorisee");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("accepts a fresh exact index proof only when the official host blocks automation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T09:00:00.000Z"));
    const result = await verifyOfficialDecision(
      { ...expectation(), indexedProof: indexedProof() },
      { fetchImpl: vi.fn().mockResolvedValue(response("Forbidden", { status: 403 })) }
    );

    expect(result.status).toBe("INDEX_VERIFIED");
    expect(result.matchedIdentifiers).toEqual(["pourvoi", "ecli", "decisionDate", "officialId"]);
    expect(isAcceptableOfficialDecisionVerification(result)).toBe(true);
  });

  it("rejects an indexed proof with a different pourvoi or an expired timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T09:00:00.000Z"));
    const result = await verifyOfficialDecision(
      {
        ...expectation(),
        indexedProof: indexedProof({ pourvoi: "23-82.999" }),
      },
      { fetchImpl: vi.fn().mockResolvedValue(response("Forbidden", { status: 403 })) }
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "preuve_indexee_pourvoi_different",
        "preuve_indexee_expiree_ou_date_invalide",
      ])
    );
  });

  it("requires explicit candidate metadata for an official proposal", async () => {
    const result = await verifyProposalOfficialEvidence({
      source: "LEGIFRANCE",
      sourceUrl: URL,
      officialId: "23-82.194",
      metadata: {},
    });

    expect(result?.verification.status).toBe("UNCHECKED");
    expect(result?.verification.issues).toContain("decision_officielle_candidate_absente");
  });

  it("rejects a source URL different from the decision candidate", async () => {
    const result = await verifyProposalOfficialEvidence({
      source: "LEGIFRANCE",
      sourceUrl: URL,
      metadata: {
        courtDecisionCandidate: {
          url: "https://www.legifrance.gouv.fr/juri/id/JURITEXT000050868554",
          pourvoi: "23-83.178",
          date: "2024-12-18",
          legifranceId: "JURITEXT000050868554",
        },
      },
    });

    expect(result?.verification.status).toBe("MISMATCH");
    expect(result?.verification.issues).toContain("source_url_et_decision_candidate_differentes");
  });

  it("marks stale indexed evidence as unacceptable in the admin summary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T09:00:00.000Z"));
    const proof = indexedProof();
    const summary = summarizeProposalOfficialEvidence({
      source: "LEGIFRANCE",
      sourceUrl: URL,
      metadata: {
        courtDecisionCandidate: {
          url: URL,
          pourvoi: "23-82.194",
          ecli: "FR:CCASS:2024:CR00817",
          date: "2024-06-19",
          legifranceId: "JURITEXT000049774995",
          indexedProof: proof,
          verification: {
            version: 1,
            status: "INDEX_VERIFIED",
            checkedAt: proof.verifiedAt,
            requestedUrl: URL,
            resolvedUrl: URL,
            httpStatus: 403,
            contentHash: null,
            matchedIdentifiers: ["pourvoi", "ecli", "decisionDate", "officialId"],
            issues: ["http_403"],
            indexedProof: proof,
          },
        },
      },
    });

    expect(summary.required).toBe(true);
    expect(summary.acceptable).toBe(false);
    expect(summary.issues).toContain("preuve_indexee_expiree_ou_date_invalide");
  });
});
