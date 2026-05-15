/**
 * One-shot research script: sample 50 Judilibre NO_MATCH decisions and
 * print enough context to a human operator to classify them into:
 *   - non-political (e.g. random person, anonymized civil case)
 *   - political-but-anonymized (Judilibre stripped the name)
 *   - political-clear-scoring-rejected (resolver missed it)
 *   - other
 *
 * Reads from AffairPoliticianDecision where source = JUDILIBRE and
 * judgment = NO_MATCH. The resolver stores:
 *   - candidateText (TEXT, first 2000 chars of the Judilibre summary)
 *   - topCandidates (JSON, ScoredCandidate[] with candidateId + totalScore + signals)
 *   - metadata (JSON, { source, sourceRef, verdictDate, externalIds: { ecli, pourvoiNumber } })
 *   - topScore, gap, sourceRef
 *
 * Politician names are looked up by candidateId in a second query so the
 * operator sees a readable name instead of a cuid.
 */
import "dotenv/config";
import { db } from "../src/lib/db";

interface ScoredCandidate {
  candidateId: string;
  totalScore: number;
  signals?: Array<{ name: string; logLikelihoodRatio?: number }>;
  disqualified?: { reason: string };
}

interface MetadataShape {
  source?: string;
  sourceRef?: string | null;
  verdictDate?: string | null;
  externalIds?: {
    ecli?: string | null;
    pourvoiNumber?: string | null;
    wikidataQId?: string | null;
  };
}

interface Sample {
  decisionId: string;
  textHash: string;
  createdAt: Date;
  sourceRef: string;
  topScore: number;
  gap: number;
  topCandidates: Array<{ name: string; score: number; firedSignals: string[] }>;
  ecli: string | null;
  pourvoi: string | null;
  verdictDate: string | null;
  rawTextPreview: string;
  metadataKeys: string[];
}

async function main() {
  const rows = await db.affairPoliticianDecision.findMany({
    where: { source: "JUDILIBRE", judgment: "NO_MATCH" },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      textHash: true,
      createdAt: true,
      sourceRef: true,
      topScore: true,
      gap: true,
      candidateText: true,
      topCandidates: true,
      metadata: true,
    },
  });

  // Collect every candidateId so we can resolve names in a single query.
  const candidateIds = new Set<string>();
  for (const r of rows) {
    const cands = (r.topCandidates as unknown as ScoredCandidate[] | null) ?? [];
    for (const c of cands) if (c.candidateId) candidateIds.add(c.candidateId);
  }

  const politicians = candidateIds.size
    ? await db.politician.findMany({
        where: { id: { in: [...candidateIds] } },
        select: { id: true, fullName: true },
      })
    : [];
  const nameById = new Map(politicians.map((p) => [p.id, p.fullName]));

  const samples: Sample[] = rows.map((r) => {
    const meta = (r.metadata as unknown as MetadataShape | null) ?? {};
    const rawCandidates = (r.topCandidates as unknown as ScoredCandidate[] | null) ?? [];
    const topCandidates = rawCandidates.slice(0, 3).map((c) => ({
      name: nameById.get(c.candidateId) ?? c.candidateId.slice(0, 12),
      score: c.totalScore,
      firedSignals: (c.signals ?? [])
        .filter((s) => typeof s.logLikelihoodRatio === "number" && s.logLikelihoodRatio !== 0)
        .map((s) => `${s.name}=${s.logLikelihoodRatio?.toFixed(1)}`),
    }));
    return {
      decisionId: r.id,
      textHash: r.textHash.slice(0, 16),
      createdAt: r.createdAt,
      sourceRef: r.sourceRef ?? "",
      topScore: r.topScore,
      gap: r.gap,
      topCandidates,
      ecli: meta.externalIds?.ecli ?? null,
      pourvoi: meta.externalIds?.pourvoiNumber ?? null,
      verdictDate: meta.verdictDate ?? null,
      rawTextPreview: (r.candidateText ?? "").slice(0, 240),
      metadataKeys: Object.keys(meta ?? {}),
    };
  });

  console.log(`Sampled ${samples.length} JUDILIBRE NO_MATCH decisions.\n`);

  console.table(
    samples.map((s) => ({
      id: s.decisionId.slice(0, 8),
      when: s.createdAt.toISOString().slice(0, 10),
      topCand: s.topCandidates[0]?.name ?? "-",
      topScore: s.topCandidates[0] ? s.topCandidates[0].score.toFixed(1) : "-",
      gap: s.gap.toFixed(1),
      ecli: s.ecli ?? "-",
    }))
  );

  console.log("\n=== Detailed preview of first 10 decisions ===\n");
  for (const s of samples.slice(0, 10)) {
    console.log(`--- decision ${s.decisionId} (${s.createdAt.toISOString().slice(0, 10)}) ---`);
    console.log(
      `  ECLI: ${s.ecli ?? "(none)"} | pourvoi: ${s.pourvoi ?? "(none)"} | verdict: ${s.verdictDate ?? "(none)"}`
    );
    console.log(`  topScore=${s.topScore.toFixed(2)} gap=${s.gap.toFixed(2)} (FLOOR_SCORE=3.0)`);
    if (s.topCandidates.length === 0) {
      console.log("  no candidates ranked (likely no name match in text)");
    } else {
      for (const c of s.topCandidates) {
        console.log(
          `  - ${c.name} score=${c.score.toFixed(2)} signals=[${c.firedSignals.join(", ")}]`
        );
      }
    }
    console.log(`  preview: ${s.rawTextPreview || "(empty candidateText)"}`);
    console.log("");
  }

  console.log("=== Aggregate signals ===");
  const noCandidateCount = samples.filter((s) => s.topCandidates.length === 0).length;
  const belowFloorCount = samples.filter(
    (s) => s.topCandidates.length > 0 && s.topScore < 3
  ).length;
  const aboveFloorCount = samples.filter((s) => s.topScore >= 3).length;
  console.log(`  no candidate ranked: ${noCandidateCount}`);
  console.log(`  below FLOOR_SCORE=3 with at least 1 candidate: ${belowFloorCount}`);
  console.log(`  above FLOOR_SCORE but rejected (should be 0 for NO_MATCH): ${aboveFloorCount}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
