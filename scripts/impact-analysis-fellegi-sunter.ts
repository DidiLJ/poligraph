/**
 * Impact analysis: re-scores all existing IdentityDecisions with the
 * Fellegi-Sunter combiner and reports reclassification rates.
 *
 * Usage: npx dotenv -e .env -- npx tsx scripts/impact-analysis-fellegi-sunter.ts
 *
 * This script does NOT modify any data. Read-only analysis.
 */
import { db } from "@/lib/db";
import { Judgement } from "@/generated/prisma";
import { BirthdateSignal } from "@/lib/identity/signals/birthdate";
import { DepartmentSignal } from "@/lib/identity/signals/department";
import { FirstNameSignal } from "@/lib/identity/signals/first-name";
import { GenderSignal } from "@/lib/identity/signals/gender";
import { NameFrequencySignal } from "@/lib/identity/signals/name-frequency";
import { FellegiSunterCombiner } from "@/lib/identity/fellegi-sunter-combiner";
import { NameFrequencyCache } from "@/lib/identity/frequency";
import { FrenchAdapter } from "@/lib/identity/adapters/fr";
import type {
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "@/lib/identity/signals/types";

const birthdateSignal = new BirthdateSignal();
const departmentSignal = new DepartmentSignal();
const firstNameSignal = new FirstNameSignal();
const genderSignal = new GenderSignal();
const nameFrequencySignal = new NameFrequencySignal();
const fsCombiner = new FellegiSunterCombiner();

async function main() {
  console.log("[impact] Loading frequency cache...");
  const freqCache = await NameFrequencyCache.loadFromDb();
  console.log(
    `[impact] Cache loaded: ${freqCache.uniqueNames} unique names, ${freqCache.totalRecords} total records`
  );

  console.log("[impact] Loading SAME decisions...");
  const sameDecisions = await db.identityDecision.findMany({
    where: { judgement: Judgement.SAME, supersededBy: null },
    include: {
      politician: {
        select: {
          firstName: true,
          lastName: true,
          birthDate: true,
          civility: true,
          prominenceScore: true,
          mandates: {
            where: { departmentCode: { not: null } },
            select: { departmentCode: true },
          },
        },
      },
    },
  });

  console.log(`[impact] Analyzing ${sameDecisions.length} SAME decisions...`);

  const fsCtx: SignalScoringContext = {
    adapter: FrenchAdapter,
    mode: "fellegi-sunter",
    nameFrequency: freqCache,
    totalRecords: freqCache.totalRecords,
    uniqueNames: freqCache.uniqueNames,
  };

  let sameToSame = 0;
  let sameToUndecided = 0;
  let sameToReject = 0;
  const reclassified: {
    sourceId: string;
    sourceType: string;
    politicianName: string;
    fsJudgement: string;
    logRatio: number;
  }[] = [];

  for (const decision of sameDecisions) {
    if (!decision.politician) {
      sameToReject++;
      continue;
    }

    const evidence = decision.evidence as Record<string, unknown> | null;

    const input: SignalScoringInput = {
      firstName: (evidence?.firstName as string) ?? "",
      lastName: (evidence?.lastName as string) ?? decision.politician.lastName,
      birthDate: evidence?.birthDate ? new Date(evidence.birthDate as string) : null,
      department: (evidence?.department as string) ?? null,
      gender: (evidence?.gender as string) ?? null,
    };

    const candidate: SignalCandidateRecord = {
      id: decision.politicianId,
      firstName: decision.politician.firstName,
      lastName: decision.politician.lastName,
      birthDate: decision.politician.birthDate,
      departments: decision.politician.mandates
        .map((m) => m.departmentCode)
        .filter((d): d is string => d !== null),
      gender:
        decision.politician.civility === "Mme"
          ? "F"
          : decision.politician.civility === "M."
            ? "M"
            : null,
      prominenceScore: decision.politician.prominenceScore,
    };

    const signals = [
      birthdateSignal.evaluate(input, candidate, fsCtx),
      departmentSignal.evaluate(input, candidate, fsCtx),
      firstNameSignal.evaluate(input, candidate, fsCtx),
      genderSignal.evaluate(input, candidate, fsCtx),
      nameFrequencySignal.evaluate(input, candidate, fsCtx),
    ];

    const fsResult = fsCombiner.combine(signals);

    if (fsResult.judgement === Judgement.SAME) {
      sameToSame++;
    } else if (fsResult.judgement === Judgement.UNDECIDED) {
      sameToUndecided++;
      reclassified.push({
        sourceId: decision.sourceId,
        sourceType: decision.sourceType,
        politicianName: `${decision.politician.firstName} ${decision.politician.lastName}`,
        fsJudgement: "UNDECIDED",
        logRatio: fsResult.compositeLogRatio,
      });
    } else {
      sameToReject++;
      reclassified.push({
        sourceId: decision.sourceId,
        sourceType: decision.sourceType,
        politicianName: `${decision.politician.firstName} ${decision.politician.lastName}`,
        fsJudgement: "REJECT",
        logRatio: fsResult.compositeLogRatio,
      });
    }
  }

  const total = sameDecisions.length;
  console.log(`\n[impact] Results:`);
  console.log(`  SAME -> SAME:      ${sameToSame} (${pct(sameToSame, total)})`);
  console.log(`  SAME -> UNDECIDED: ${sameToUndecided} (${pct(sameToUndecided, total)})`);
  console.log(`  SAME -> REJECT:    ${sameToReject} (${pct(sameToReject, total)})`);

  if (reclassified.length > 0) {
    console.log(`\n[impact] Reclassified decisions (first 20):`);
    for (const r of reclassified.slice(0, 20)) {
      console.log(
        `  ${r.sourceType}:${r.sourceId} -> ${r.politicianName} = ${r.fsJudgement} (logRatio=${r.logRatio.toFixed(1)})`
      );
    }
  }

  if (sameToUndecided > 0 || sameToReject > 0) {
    console.log(
      `\n[impact] GATE FAILED: ${sameToUndecided + sameToReject} SAME decisions would be reclassified.`
    );
    console.log(`[impact] DO NOT switch to Fellegi-Sunter mode until these are reviewed.`);
  } else {
    console.log(`\n[impact] GATE PASSED: All SAME decisions remain SAME under F-S scoring.`);
    console.log(`[impact] Safe to switch combiner mode to "fellegi-sunter".`);
  }

  await db.$disconnect();
}

function pct(n: number, total: number): string {
  return total === 0 ? "0%" : `${((n / total) * 100).toFixed(1)}%`;
}

main().catch(console.error);
