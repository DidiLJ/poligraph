import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import {
  IMPORTANCE_WEIGHTS,
  KEY_VOTE_THRESHOLD,
  VOTE_TYPE_SCORES,
} from "@/config/scrutin-importance";

export interface SignalInput {
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalDeputies: number;
  pressMentions: number;
  hasDossier: boolean;
  hasCitizenImpact: boolean;
  voteType: string;
}

export interface Signals {
  turnout: number;
  margin: number;
  pressCoverage: number;
  hasDossier: number;
  hasCitizenImpact: number;
  voteType: number;
}

const PRESS_MENTIONS_CAP = 10;

export function computeSignals(input: SignalInput): Signals {
  const totalVotes = input.votesFor + input.votesAgainst + input.votesAbstain;
  const turnout = input.totalDeputies > 0 ? totalVotes / input.totalDeputies : 0;

  const expressed = input.votesFor + input.votesAgainst;
  const marginRatio = expressed > 0 ? Math.abs(input.votesFor - input.votesAgainst) / expressed : 0;
  const margin = 1 - marginRatio;

  const pressCoverage = Math.min(input.pressMentions / PRESS_MENTIONS_CAP, 1);

  return {
    turnout: Math.min(turnout, 1),
    margin,
    pressCoverage,
    hasDossier: input.hasDossier ? 1 : 0,
    hasCitizenImpact: input.hasCitizenImpact ? 1 : 0,
    voteType: VOTE_TYPE_SCORES[input.voteType] ?? VOTE_TYPE_SCORES.default!,
  };
}

export function computeScore(signals: Signals): number {
  const raw =
    signals.turnout * IMPORTANCE_WEIGHTS.turnoutRatio +
    signals.margin * IMPORTANCE_WEIGHTS.marginCloseness +
    signals.pressCoverage * IMPORTANCE_WEIGHTS.pressCoverage +
    signals.hasDossier * IMPORTANCE_WEIGHTS.hasDossier +
    signals.hasCitizenImpact * IMPORTANCE_WEIGHTS.hasCitizenImpact +
    signals.voteType * IMPORTANCE_WEIGHTS.voteType;

  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}

const CHAMBER_SIZE: Record<string, number> = { AN: 577, SENAT: 348 };

export async function computeImportanceScores(): Promise<{
  scored: number;
  promoted: number;
}> {
  const scrutins = await db.scrutin.findMany({
    select: {
      id: true,
      chamber: true,
      votesFor: true,
      votesAgainst: true,
      votesAbstain: true,
      dossierLegislatifId: true,
      citizenImpact: true,
      importance: { select: { isKeyVote: true } },
    },
  });

  // Batch press coverage: single query counting articles per scrutin date window
  const pressCounts = await db.$queryRaw<Array<{ scrutinId: string; count: bigint }>>`
    SELECT s.id AS "scrutinId", COUNT(pa.id) AS count
    FROM "Scrutin" s
    LEFT JOIN "PressArticle" pa
      ON pa."publishedAt" BETWEEN s."votingDate" - INTERVAL '1 day' AND s."votingDate" + INTERVAL '2 days'
    GROUP BY s.id
  `;
  const pressMap = new Map(pressCounts.map((r) => [r.scrutinId, Number(r.count)]));

  let scored = 0;
  let promoted = 0;

  const BATCH_SIZE = 100;
  for (let i = 0; i < scrutins.length; i += BATCH_SIZE) {
    const batch = scrutins.slice(i, i + BATCH_SIZE);
    const upserts = batch.map((s) => {
      const signals = computeSignals({
        votesFor: s.votesFor,
        votesAgainst: s.votesAgainst,
        votesAbstain: s.votesAbstain,
        totalDeputies: CHAMBER_SIZE[s.chamber] ?? 577,
        pressMentions: pressMap.get(s.id) ?? 0,
        hasDossier: !!s.dossierLegislatifId,
        hasCitizenImpact: !!s.citizenImpact,
        voteType: "default",
      });

      const score = computeScore(signals);
      const wasKeyVote = s.importance?.isKeyVote ?? false;
      const isKeyVote = wasKeyVote || score >= KEY_VOTE_THRESHOLD;

      if (isKeyVote && !wasKeyVote) promoted++;
      scored++;

      return db.scrutinImportance.upsert({
        where: { scrutinId: s.id },
        create: {
          scrutinId: s.id,
          score,
          isKeyVote,
          signals: signals as unknown as Prisma.InputJsonValue,
        },
        update: {
          score,
          isKeyVote,
          signals: signals as unknown as Prisma.InputJsonValue,
        },
      });
    });

    for (let j = 0; j < upserts.length; j += 10) {
      await Promise.all(upserts.slice(j, j + 10));
    }
  }

  return { scored, promoted };
}
