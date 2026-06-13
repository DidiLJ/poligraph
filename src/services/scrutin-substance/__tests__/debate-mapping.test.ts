import { describe, it, expect } from "vitest";
import { classifyDebateMatch } from "@/services/scrutin-substance/debate-mapping";

describe("classifyDebateMatch — strict mapping (matched/ambiguous/missing/unsafe)", () => {
  it("HIGH + exactly 1 candidate transcript → matched (exploitable)", () => {
    const v = classifyDebateMatch({
      hasCandidateTranscript: true,
      candidateTranscriptCount: 1,
      confidence: "HIGH",
    });
    expect(v.class).toBe("matched");
    expect(v.exploitable).toBe(true);
  });

  it("HIGH but several same-day transcripts → ambiguous (session not proven)", () => {
    const v = classifyDebateMatch({
      hasCandidateTranscript: true,
      candidateTranscriptCount: 3,
      confidence: "HIGH",
    });
    expect(v.class).toBe("ambiguous");
    expect(v.exploitable).toBe(false);
  });

  it("MEDIUM (author + article, no number) → ambiguous, never matched", () => {
    const v = classifyDebateMatch({
      hasCandidateTranscript: true,
      candidateTranscriptCount: 1,
      confidence: "MEDIUM",
    });
    expect(v.class).toBe("ambiguous");
    expect(v.exploitable).toBe(false);
  });

  it("transcript present but NONE (no explicit mention) → unsafe", () => {
    const v = classifyDebateMatch({
      hasCandidateTranscript: true,
      candidateTranscriptCount: 1,
      confidence: "NONE",
    });
    expect(v.class).toBe("unsafe");
    expect(v.exploitable).toBe(false);
  });

  it("transcript present but only LOW (author or article alone) → unsafe", () => {
    const v = classifyDebateMatch({
      hasCandidateTranscript: true,
      candidateTranscriptCount: 2,
      confidence: "LOW",
    });
    expect(v.class).toBe("unsafe");
    expect(v.exploitable).toBe(false);
  });

  it("no candidate transcript at all → missing", () => {
    const v = classifyDebateMatch({
      hasCandidateTranscript: false,
      candidateTranscriptCount: 0,
      confidence: "NONE",
    });
    expect(v.class).toBe("missing");
    expect(v.exploitable).toBe(false);
  });

  it("guards against count/flag mismatch: count 0 is treated as missing", () => {
    const v = classifyDebateMatch({
      hasCandidateTranscript: true,
      candidateTranscriptCount: 0,
      confidence: "HIGH",
    });
    expect(v.class).toBe("missing");
  });

  it("false positive protection: a same-day transcript that only echoes the dossier theme (NONE) is unsafe, never matched", () => {
    // Mirrors the real 2084 case: transcript exists, dossier words present, but
    // the amendment number is never cited → confidence NONE → must NOT be matched.
    const v = classifyDebateMatch({
      hasCandidateTranscript: true,
      candidateTranscriptCount: 1,
      confidence: "NONE",
    });
    expect(v.class).toBe("unsafe");
    expect(v.exploitable).toBe(false);
  });
});
