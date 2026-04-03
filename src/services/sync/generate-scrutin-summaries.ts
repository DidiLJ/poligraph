/**
 * Orchestration service for generating AI summaries for scrutins.
 * Uses Mistral Small for cost-efficient generation.
 */

import { db } from "@/lib/db";
import { callMistral, extractMistralText } from "@/lib/api/mistral";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "@/config/rate-limits";

const SYSTEM_PROMPT = `Tu es un assistant parlementaire expert. Résume ce scrutin en 2-3 phrases concises pour un citoyen français.
Inclus: le sujet du vote, le résultat (adopté/rejeté), et les principaux enjeux.
Écris en français courant, sans jargon technique. Ne mentionne pas les numéros d'articles.`;

export interface ScrutinSummariesResult {
  processed: number;
  generated: number;
  skipped: number;
  errors: string[];
}

export async function generateScrutinSummaries(options?: {
  limit?: number;
  force?: boolean;
}): Promise<ScrutinSummariesResult> {
  const { limit = 30, force = false } = options ?? {};

  const stats: ScrutinSummariesResult = {
    processed: 0,
    generated: 0,
    skipped: 0,
    errors: [],
  };

  const scrutins = await db.scrutin.findMany({
    where: {
      ...(force ? {} : { summary: null }),
      votes: { some: {} },
    },
    orderBy: { votingDate: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      result: true,
      votesFor: true,
      votesAgainst: true,
      votesAbstain: true,
      chamber: true,
    },
  });

  if (scrutins.length === 0) return stats;

  for (const s of scrutins) {
    stats.processed++;
    const resultLabel = s.result === "ADOPTED" ? "Adopté" : "Rejeté";
    const chamberLabel = s.chamber === "AN" ? "Assemblée nationale" : "Sénat";

    const prompt = `Scrutin: ${s.title}
Chambre: ${chamberLabel}
Résultat: ${resultLabel} (Pour: ${s.votesFor}, Contre: ${s.votesAgainst}, Abstention: ${s.votesAbstain})`;

    try {
      const response = await callMistral([{ role: "user", content: prompt }], {
        model: "mistral-small-latest",
        system: SYSTEM_PROMPT,
        maxTokens: 300,
        temperature: 0.3,
      });

      const summary = extractMistralText(response).trim();
      if (!summary) {
        stats.skipped++;
        continue;
      }

      await db.scrutin.update({
        where: { id: s.id },
        data: { summary },
      });
      stats.generated++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isRateLimit = /429|rate.limit|quota/i.test(msg);

      stats.errors.push(`${s.title.slice(0, 60)}: ${msg.slice(0, 100)}`);

      if (isRateLimit) {
        console.error(`[scrutin-summaries] Rate limit hit, backing off ${AI_429_BACKOFF_MS}ms`);
        await new Promise((r) => setTimeout(r, AI_429_BACKOFF_MS));
      }
    }

    await new Promise((r) => setTimeout(r, AI_RATE_LIMIT_MS));
  }

  return stats;
}
