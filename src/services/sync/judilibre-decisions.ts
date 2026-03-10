/**
 * Judilibre IdentityDecision cache and persist helper.
 *
 * Loads NOT_SAME (blocked) and SAME (confirmed) decisions at sync start
 * for O(1) lookups during the Judilibre sync pipeline.
 */

import { db } from "@/lib/db";
import { DataSource, Judgement, type MatchMethod, type Prisma } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Evidence type (matches judilibre-scoring.ts shape)
// ---------------------------------------------------------------------------

export interface JudilibreMatchEvidence {
  nameQuality: string | null;
  contextSignal: string;
  score: number;
  fullNameFound: boolean;
  legalTitleFound: boolean;
  proximityFound: boolean;
  jurisdictionCity: string | null;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

export interface JudilibreDecisionCache {
  isBlocked(decisionId: string, politicianId: string): boolean;
  getConfirmed(
    decisionId: string,
    politicianId: string
  ): { confidence: number; politicianId: string } | null;
  size: { blocked: number; confirmed: number };
}

function cacheKey(decisionId: string, politicianId: string): string {
  return `${decisionId}::${politicianId}`;
}

export async function loadJudilibreDecisionCache(): Promise<JudilibreDecisionCache> {
  const decisions = await db.identityDecision.findMany({
    where: {
      sourceType: DataSource.JUDILIBRE,
      supersededBy: null,
    },
    select: {
      sourceId: true,
      politicianId: true,
      judgement: true,
      confidence: true,
    },
  });

  const blocked = new Set<string>();
  const confirmed = new Map<string, { confidence: number; politicianId: string }>();

  for (const d of decisions) {
    const key = cacheKey(d.sourceId, d.politicianId);
    if (d.judgement === Judgement.NOT_SAME) {
      blocked.add(key);
    } else if (d.judgement === Judgement.SAME) {
      confirmed.set(key, { confidence: d.confidence, politicianId: d.politicianId });
    }
    // UNDECIDED decisions are ignored
  }

  return {
    isBlocked(decisionId: string, politicianId: string): boolean {
      return blocked.has(cacheKey(decisionId, politicianId));
    },
    getConfirmed(
      decisionId: string,
      politicianId: string
    ): { confidence: number; politicianId: string } | null {
      return confirmed.get(cacheKey(decisionId, politicianId)) ?? null;
    },
    get size() {
      return { blocked: blocked.size, confirmed: confirmed.size };
    },
  };
}

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------

export interface PersistJudilibreDecisionInput {
  decisionId: string;
  politicianId: string;
  judgement: Judgement;
  confidence: number;
  method: MatchMethod;
  evidence: JudilibreMatchEvidence;
}

export async function persistJudilibreDecision(
  input: PersistJudilibreDecisionInput
): Promise<void> {
  try {
    await db.identityDecision.create({
      data: {
        sourceType: DataSource.JUDILIBRE,
        sourceId: input.decisionId,
        politicianId: input.politicianId,
        judgement: input.judgement,
        confidence: input.confidence,
        method: input.method,
        evidence: input.evidence as unknown as Prisma.InputJsonValue,
        decidedBy: "system:sync-judilibre",
      },
    });
  } catch (error) {
    console.error("[judilibre-decisions] Failed to persist decision:", error);
  }
}
