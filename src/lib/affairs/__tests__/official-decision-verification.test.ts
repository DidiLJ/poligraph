import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OFFICIAL_DECISION_VERIFICATION_STATUSES,
  isAcceptableOfficialDecisionVerification,
  summarizeProposalOfficialEvidence,
  summarizeProposalSourceLink,
  verifyAndAnnotateProposalOfficialEvidence,
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

  it.each(OFFICIAL_DECISION_VERIFICATION_STATUSES)(
    "accepts only a direct VALID verification, not %s by declaration",
    (status) => {
      expect(
        isAcceptableOfficialDecisionVerification({
          version: 1,
          status,
          checkedAt: "2026-08-18T09:00:00.000Z",
          requestedUrl: URL,
          resolvedUrl: URL,
          httpStatus: status === "VALID" ? 200 : null,
          contentHash: null,
          matchedIdentifiers: [],
          issues: [],
          indexedProof: null,
        })
      ).toBe(status === "VALID");
    }
  );

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

  it("refuses non-official hosts before a network request", async () => {
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

  it("keeps a fresh caller-provided index proof informative but unacceptable after a 403", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T09:00:00.000Z"));
    const result = await verifyOfficialDecision(
      { ...expectation(), indexedProof: indexedProof() },
      { fetchImpl: vi.fn().mockResolvedValue(response("Forbidden", { status: 403 })) }
    );

    expect(result.status).toBe("INDEX_VERIFIED");
    expect(result.matchedIdentifiers).toEqual(["pourvoi", "ecli", "decisionDate", "officialId"]);
    expect(isAcceptableOfficialDecisionVerification(result)).toBe(false);
  });

  it("does not trust authority flags added by the importer to indexed proof JSON", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T09:00:00.000Z"));
    const proof = {
      ...indexedProof(),
      trusted: true,
      verifiedBy: "server",
      official: true,
      humanValidated: true,
    };
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
          trusted: true,
          humanValidated: true,
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
            acceptable: true,
            verifiedBy: "server",
          },
        },
      },
    });

    expect(summary.status).toBe("INDEX_VERIFIED");
    expect(summary.acceptable).toBe(false);
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

  it("does not construct an official URL from identifiers when no URL was supplied", async () => {
    const fetchImpl = vi.fn();
    const result = await verifyProposalOfficialEvidence(
      {
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
      },
      { fetchImpl }
    );

    expect(result?.sourceUrl).toBe("");
    expect(result?.verification.status).toBe("UNCHECKED");
    expect(result?.verification.issues).toContain("url_decision_absente");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("classifies a redirect to another official decision as a mismatch", async () => {
    const otherUrl = "https://www.legifrance.gouv.fr/juri/id/JURITEXT000050868554";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 302, headers: { location: otherUrl } }))
      .mockResolvedValueOnce(response("Autre décision", { url: otherUrl }));

    const result = await verifyOfficialDecision(expectation(), { fetchImpl });

    expect(result.status).toBe("MISMATCH");
    expect(result.issues).toContain("redirection_vers_autre_decision");
    expect(isAcceptableOfficialDecisionVerification(result)).toBe(false);
  });

  it("blocks a redirect to a generic official page", async () => {
    const result = await verifyOfficialDecision(expectation(), {
      fetchImpl: vi.fn().mockResolvedValue(
        response("", {
          status: 302,
          headers: { location: "https://www.legifrance.gouv.fr/" },
        })
      ),
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.issues[0]).toContain("redirection_non_autorisee");
  });

  it("normalizes a concordant redirect and stores a direct VALID verification", async () => {
    const normalizedUrl = "https://legifrance.gouv.fr/juri/id/JURITEXT000049774995";
    const body = "N° 23-82.194 ECLI:FR:CCASS:2024:CR00817 19 JUIN 2024 REJET";
    const input = {
      source: "LEGIFRANCE",
      sourceUrl: URL,
      metadata: {
        courtDecisionCandidate: {
          url: URL,
          pourvoi: "23-82.194",
          ecli: "FR:CCASS:2024:CR00817",
          date: "2024-06-19",
          legifranceId: "JURITEXT000049774995",
        },
      },
    };
    const verified = await verifyAndAnnotateProposalOfficialEvidence(input, {
      fetchImpl: vi
        .fn()
        .mockResolvedValueOnce(response("", { status: 302, headers: { location: normalizedUrl } }))
        .mockResolvedValueOnce(response(body, { url: normalizedUrl }))
        .mockResolvedValueOnce(response(body, { url: normalizedUrl })),
    });

    expect(verified?.verification.status).toBe("VALID");
    expect(verified?.sourceUrl).toBe(normalizedUrl);
    expect(isAcceptableOfficialDecisionVerification(verified!.verification)).toBe(true);
    expect(verified?.metadata).toMatchObject({
      courtDecisionCandidate: {
        url: normalizedUrl,
        canonicalUrl: normalizedUrl,
        urlNormalization: {
          initialUrl: URL,
          finalUrl: normalizedUrl,
          reason: "OFFICIAL_REDIRECT",
        },
      },
    });
  });

  it("blocks creation when the direct verification after a redirect mismatches", async () => {
    const normalizedUrl = "https://legifrance.gouv.fr/juri/id/JURITEXT000049774995";
    const matchingBody = "N° 23-82.194 ECLI:FR:CCASS:2024:CR00817 19 JUIN 2024 REJET";
    const mismatchingBody = "N° 23-82.999 ECLI:FR:CCASS:2024:CR00999 20 JUIN 2024";

    await expect(
      verifyAndAnnotateProposalOfficialEvidence(
        {
          source: "LEGIFRANCE",
          sourceUrl: URL,
          metadata: {
            courtDecisionCandidate: {
              url: URL,
              pourvoi: "23-82.194",
              ecli: "FR:CCASS:2024:CR00817",
              date: "2024-06-19",
              legifranceId: "JURITEXT000049774995",
            },
          },
        },
        {
          fetchImpl: vi
            .fn()
            .mockResolvedValueOnce(
              response("", { status: 302, headers: { location: normalizedUrl } })
            )
            .mockResolvedValueOnce(response(matchingBody, { url: normalizedUrl }))
            .mockResolvedValueOnce(response(mismatchingBody, { url: normalizedUrl })),
        }
      )
    ).rejects.toMatchObject({ verification: { status: "MISMATCH" } });
  });

  it("does not turn a 403 after redirect normalization into VALID", async () => {
    const normalizedUrl = "https://legifrance.gouv.fr/juri/id/JURITEXT000049774995";
    const matchingBody = "N° 23-82.194 ECLI:FR:CCASS:2024:CR00817 19 JUIN 2024 REJET";

    await expect(
      verifyAndAnnotateProposalOfficialEvidence(
        {
          source: "LEGIFRANCE",
          sourceUrl: URL,
          metadata: {
            courtDecisionCandidate: {
              url: URL,
              pourvoi: "23-82.194",
              ecli: "FR:CCASS:2024:CR00817",
              date: "2024-06-19",
              legifranceId: "JURITEXT000049774995",
            },
          },
        },
        {
          fetchImpl: vi
            .fn()
            .mockResolvedValueOnce(
              response("", { status: 302, headers: { location: normalizedUrl } })
            )
            .mockResolvedValueOnce(response(matchingBody, { url: normalizedUrl }))
            .mockResolvedValueOnce(response("Forbidden", { status: 403, url: normalizedUrl })),
        }
      )
    ).rejects.toMatchObject({ verification: { status: "BLOCKED" } });
  });

  it.each([
    ["HTTPS", "https://press.example.test/politique/article-test.html", true],
    ["HTTP", "http://press.example.test/politique/article-test", true],
    ["JavaScript", "javascript:alert(1)", false],
    ["data", "data:text/html,<script>alert(1)</script>", false],
    ["credentials", "https://user:password@example.com/article", false],
    ["invalid syntax", "not a URL", false],
  ])("validates an ordinary %s editorial source link", (_label, rawUrl, expectedSafe) => {
    const summary = summarizeProposalSourceLink(rawUrl);

    expect(summary.rawUrl).toBe(rawUrl);
    expect(summary.safeUrl !== null).toBe(expectedSafe);
  });

  it("does not transform an ordinary press source into official decision evidence", async () => {
    const sourceUrl = "https://press.example.test/politique/article-test.html";

    expect(
      await verifyProposalOfficialEvidence({
        source: "PRESSE",
        sourceUrl,
        metadata: { editorialSource: "Le Monde" },
      })
    ).toBeNull();
    expect(summarizeProposalOfficialEvidence({ source: "PRESSE", sourceUrl })).toMatchObject({
      required: false,
      canonicalUrl: null,
      requestedUrl: null,
    });
    expect(summarizeProposalSourceLink(sourceUrl).safeUrl).toBe(sourceUrl);
  });

  it.each([
    ["a lookalike Légifrance host", "https://legifrance.gouv.fr.example.com/juri/id/JURITEXT1"],
    ["a JavaScript URL", "javascript:alert(1)"],
    ["an arbitrary candidate domain", "https://example.com/decision/123"],
    ["a non-canonical Cour de cassation path", "https://www.courdecassation.fr/agenda"],
  ])("never exposes %s as a clickable admin URL", (_label, rawUrl) => {
    const summary = summarizeProposalOfficialEvidence({
      source: "LEGIFRANCE",
      sourceUrl: URL,
      metadata: { courtDecisionCandidate: { canonicalUrl: rawUrl, url: URL } },
    });

    expect(summary.canonicalUrl).toBeNull();
    expect(summary.requestedUrl).toBe(rawUrl);
    expect(summary.issues).toEqual(
      expect.arrayContaining([expect.stringMatching(/^url_administration_non_cliquable:/)])
    );
  });

  it.each([
    ["Légifrance", URL],
    ["ArianeWeb", "https://www.conseil-etat.fr/fr/arianeweb/CE/decision/2024-06-19/472007"],
  ])("keeps a canonical %s URL clickable in the admin summary", (_provider, rawUrl) => {
    const summary = summarizeProposalOfficialEvidence({
      source: "LEGIFRANCE",
      sourceUrl: rawUrl,
      metadata: { courtDecisionCandidate: { canonicalUrl: rawUrl } },
    });

    expect(summary.canonicalUrl).toBe(rawUrl);
    expect(summary.requestedUrl).toBe(rawUrl);
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
