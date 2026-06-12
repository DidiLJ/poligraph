import { describe, it, expect, beforeEach, vi } from "vitest";

const scrutinFindUnique = vi.fn();
const transcriptFindMany = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    scrutin: { findUnique: (...a: unknown[]) => scrutinFindUnique(...a) },
    debateTranscript: { findMany: (...a: unknown[]) => transcriptFindMany(...a) },
  },
}));

import {
  extractAuthorSurname,
  resolveDebateContextForScrutin,
} from "@/services/scrutin-substance/debate-context-resolver";

describe("extractAuthorSurname", () => {
  it("cleans AN HTML entities and the civility prefix, keeps the first surname", () => {
    expect(extractAuthorSurname("Mme&#160;Lechon,  M.&#160;Allisio, M.&#160;Amblard")).toBe(
      "Lechon"
    );
    expect(extractAuthorSurname("M. de Fleurian")).toBe("de Fleurian");
    expect(extractAuthorSurname("Mme Pannier-Runacher")).toBe("Pannier-Runacher");
  });

  it("returns null for empty / too-short names", () => {
    expect(extractAuthorSurname(null)).toBeNull();
    expect(extractAuthorSurname("")).toBeNull();
    expect(extractAuthorSurname("M. Li")).toBeNull();
  });
});

describe("resolveDebateContextForScrutin — same-day candidate scope (diagnostic only)", () => {
  beforeEach(() => {
    scrutinFindUnique.mockReset();
    transcriptFindMany.mockReset();
  });

  it("finds a HIGH across several same-day candidates but flags scope=same-day (NOT a definitive linkage)", async () => {
    scrutinFindUnique.mockResolvedValue({
      votingDate: new Date("2026-05-30"),
      amendmentLinks: [
        { amendment: { number: "2084", authorName: "Mme Lechon", article: "APRÈS L'ARTICLE 22" } },
      ],
    });
    // Two debates the SAME DAY: a different one, and the one that mentions 2084.
    transcriptFindMany.mockResolvedValue([
      { seanceRef: "SEANCE-A", content: "Sur un autre texte, l'amendement no 12 est rejeté." },
      {
        seanceRef: "SEANCE-B",
        content:
          "La parole est à Mme Léchon pour soutenir l'amendement no 2084 sur la transparence des coopératives.",
      },
    ]);

    const r = await resolveDebateContextForScrutin("s1");

    expect(r.confidence).toBe("HIGH");
    expect(r.matchedAmendmentNumber).toBe("2084");
    expect(r.transcriptSeanceRef).toBe("SEANCE-B");
    // The whole point of this PR: the candidate scope stays same-day, and there
    // were several candidates that day → this is NOT a dossier/session
    // disambiguated linkage, only a diagnostic candidate.
    expect(r.candidateScope).toBe("same-day");
    expect(r.candidateTranscriptCount).toBe(2);
    expect(r.usableForGeneration).toBe(true); // HIGH, but still "à valider avant branchement"
  });

  it("keeps scope=same-day and reports NONE when no same-day candidate mentions the amendment", async () => {
    scrutinFindUnique.mockResolvedValue({
      votingDate: new Date("2026-05-30"),
      amendmentLinks: [{ amendment: { number: "2084", authorName: "Mme Lechon", article: "22" } }],
    });
    transcriptFindMany.mockResolvedValue([
      {
        seanceRef: "SEANCE-A",
        content: "Discussion générale, aucun numéro d'amendement cité ici.",
      },
      { seanceRef: "SEANCE-B", content: "Débat sur l'amendement no 999, sans rapport." },
    ]);

    const r = await resolveDebateContextForScrutin("s1");

    expect(r.confidence).toBe("NONE");
    expect(r.usableForGeneration).toBe(false);
    expect(r.candidateScope).toBe("same-day");
    expect(r.candidateTranscriptCount).toBe(2);
    expect(r.hasCandidateTranscript).toBe(true);
  });
});
