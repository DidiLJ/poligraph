import { describe, it, expect } from "vitest";
import { PartyContextSignal } from "../../signals/party-context";
import { FrenchAdapter } from "../../adapters/fr";
import { PARTY_CURRENT_LLR, PARTY_FORMER_LLR, PARTY_NO_LINK_LLR } from "../../signals/constants";

const signal = new PartyContextSignal();
const context = { adapter: FrenchAdapter, mode: "fellegi-sunter" as const };

const makeInput = (sourceText: string | null) => ({
  firstName: "Jean",
  lastName: "Dupont",
  sourceText,
});

const makeCandidate = (
  partyMemberships: Array<{ partyId: string; partyName: string; current: boolean }> | null
) => ({
  id: "1",
  firstName: "Jean",
  lastName: "Dupont",
  birthDate: null,
  departments: [],
  gender: null,
  prominenceScore: 100,
  partyMemberships,
});

describe("PartyContextSignal", () => {
  it("returns +2.0 when text mentions current party", () => {
    const result = signal.evaluate(
      makeInput("Le depute Renaissance Jean Dupont"),
      makeCandidate([{ partyId: "p1", partyName: "Renaissance", current: true }]),
      context
    );
    expect(result.logLikelihoodRatio).toBe(PARTY_CURRENT_LLR);
  });

  it("returns +0.5 when text mentions former party", () => {
    const result = signal.evaluate(
      makeInput("L'ancien LR Jean Dupont"),
      makeCandidate([{ partyId: "p1", partyName: "Les Republicains", current: false }]),
      context
    );
    expect(result.logLikelihoodRatio).toBe(PARTY_FORMER_LLR);
  });

  it("returns -0.5 when text mentions a party but candidate has no link", () => {
    const result = signal.evaluate(
      makeInput("Le depute RN Jean Dupont"),
      makeCandidate([{ partyId: "p1", partyName: "Renaissance", current: true }]),
      context
    );
    expect(result.logLikelihoodRatio).toBe(PARTY_NO_LINK_LLR);
  });

  it("returns 0 when no source text", () => {
    const result = signal.evaluate(
      makeInput(null),
      makeCandidate([{ partyId: "p1", partyName: "Renaissance", current: true }]),
      context
    );
    expect(result.logLikelihoodRatio).toBe(0);
  });

  it("returns 0 when no party memberships", () => {
    const result = signal.evaluate(
      makeInput("Le depute Renaissance"),
      makeCandidate(null),
      context
    );
    expect(result.logLikelihoodRatio).toBe(0);
  });
});
