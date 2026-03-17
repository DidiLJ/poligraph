import { MatchMethod } from "@/generated/prisma";
import type {
  SignalEvaluator,
  SignalResult,
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "./types";
import { SignalTier } from "./types";
import { PARTY_CURRENT_LLR, PARTY_FORMER_LLR, PARTY_NO_LINK_LLR } from "./constants";

const PARTY_ALIASES: Record<string, string[]> = {
  "rassemblement national": ["rn"],
  "les republicains": ["lr"],
  "parti socialiste": ["ps"],
  renaissance: ["re", "lrem", "en marche"],
  "la france insoumise": ["lfi"],
  "europe ecologie les verts": ["eelv"],
  "parti communiste francais": ["pcf"],
  modem: ["mouvement democrate"],
  horizons: [],
  "les ecologistes": [],
};

export class PartyContextSignal implements SignalEvaluator {
  readonly id = "party-context";
  readonly description = "Party mention in source text vs candidate memberships";
  readonly tier = SignalTier.CONTEXTUAL;

  evaluate(
    input: SignalScoringInput,
    candidate: SignalCandidateRecord,
    _context: SignalScoringContext
  ): SignalResult {
    if (
      !input.sourceText ||
      !candidate.partyMemberships ||
      candidate.partyMemberships.length === 0
    ) {
      return this.neutral("No party context available");
    }

    const text = input.sourceText.toLowerCase();

    // Check each candidate membership against text
    for (const membership of candidate.partyMemberships) {
      if (this.partyMentionedInText(membership.partyName, text)) {
        const logLR = membership.current ? PARTY_CURRENT_LLR : PARTY_FORMER_LLR;
        return {
          signalId: this.id,
          logLikelihoodRatio: logLR,
          deterministic: false,
          explanation: `Party "${membership.partyName}" ${membership.current ? "current" : "former"} mentioned in text`,
          method: MatchMethod.NAME_ONLY,
        };
      }
    }

    // Check if text mentions ANY known party (even if not matching candidate)
    if (this.anyPartyMentioned(text)) {
      return {
        signalId: this.id,
        logLikelihoodRatio: PARTY_NO_LINK_LLR,
        deterministic: false,
        explanation: "Text mentions a party not matching candidate memberships",
        method: MatchMethod.NAME_ONLY,
      };
    }

    return this.neutral("No party mentions detected in text");
  }

  private partyMentionedInText(partyName: string, text: string): boolean {
    const normalized = partyName.toLowerCase();
    if (text.includes(normalized)) return true;

    // Check aliases
    for (const [canonical, aliases] of Object.entries(PARTY_ALIASES)) {
      if (canonical === normalized || aliases.some((a) => a === normalized)) {
        if (text.includes(canonical)) return true;
        if (aliases.some((a) => text.includes(a))) return true;
      }
    }

    return false;
  }

  private anyPartyMentioned(text: string): boolean {
    for (const [canonical, aliases] of Object.entries(PARTY_ALIASES)) {
      if (text.includes(canonical)) return true;
      if (aliases.some((a) => text.includes(a))) return true;
    }
    return false;
  }

  private neutral(explanation: string): SignalResult {
    return {
      signalId: this.id,
      logLikelihoodRatio: 0,
      deterministic: false,
      explanation,
      method: MatchMethod.NAME_ONLY,
    };
  }
}
