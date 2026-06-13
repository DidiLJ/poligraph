import { describe, it, expect } from "vitest";
import {
  classifyDebateMatch,
  classifyDebateMatchBySeance,
} from "@/services/scrutin-substance/debate-mapping";

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

describe("classifyDebateMatchBySeance — séance-scoped mapping (full content)", () => {
  it("exactly 1 séance of the day cites the amendment → matched, even among several séances", () => {
    const v = classifyDebateMatchBySeance({
      seanceCount: 3,
      mentioningHighCount: 1,
      hasMedium: false,
    });
    expect(v.class).toBe("matched");
    expect(v.exploitable).toBe(true);
  });

  it("the 2084 shape: single séance of the day, cites the amendment → matched", () => {
    const v = classifyDebateMatchBySeance({
      seanceCount: 1,
      mentioningHighCount: 1,
      hasMedium: false,
    });
    expect(v.class).toBe("matched");
  });

  it("≥2 séances cite the amendment (debated across sittings) → ambiguous", () => {
    const v = classifyDebateMatchBySeance({
      seanceCount: 3,
      mentioningHighCount: 2,
      hasMedium: false,
    });
    expect(v.class).toBe("ambiguous");
    expect(v.exploitable).toBe(false);
  });

  it("no explicit number but an author+article proximity (MEDIUM) → ambiguous", () => {
    const v = classifyDebateMatchBySeance({
      seanceCount: 2,
      mentioningHighCount: 0,
      hasMedium: true,
    });
    expect(v.class).toBe("ambiguous");
  });

  it("séances exist but none cites the amendment → unsafe (no false positive by date)", () => {
    const v = classifyDebateMatchBySeance({
      seanceCount: 2,
      mentioningHighCount: 0,
      hasMedium: false,
    });
    expect(v.class).toBe("unsafe");
    expect(v.exploitable).toBe(false);
  });

  it("no séance that day → missing", () => {
    const v = classifyDebateMatchBySeance({
      seanceCount: 0,
      mentioningHighCount: 0,
      hasMedium: false,
    });
    expect(v.class).toBe("missing");
  });
});
