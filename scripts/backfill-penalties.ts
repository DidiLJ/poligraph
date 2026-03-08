/**
 * Backfill existing affairs with Wikidata penalty data.
 *
 * For each politician with Wikidata external IDs, re-fetch P1399 claims
 * and extract penalty qualifiers, then update affairs with NULL penalty fields.
 *
 * Usage: npx tsx scripts/backfill-penalties.ts [--dry-run]
 */
import { db } from "@/lib/db";
import { WikidataService } from "@/lib/api/wikidata";
import { WD_PROPS } from "@/config/wikidata";
import { mapWikidataOffense, getOffenseLabel } from "@/config/wikidata-affairs";
import { extractPenaltyData } from "@/services/sync/discover-affairs";
import { findMatchingAffairs } from "@/services/affairs/matching";

const isDryRun = process.argv.includes("--dry-run");

function buildSentenceSummary(data: {
  prisonMonths: number | null;
  prisonSuspended: boolean | null;
  ineligibilityMonths: number | null;
  communityService: number | null;
  otherSentence: string | null;
}): string | null {
  const parts: string[] = [];
  if (data.prisonMonths !== null && data.prisonMonths > 0) {
    if (data.prisonMonths === 9999) {
      parts.push("réclusion criminelle à perpétuité");
    } else {
      const years = Math.floor(data.prisonMonths / 12);
      const months = data.prisonMonths % 12;
      const duration =
        years > 0 && months > 0
          ? `${years} an${years > 1 ? "s" : ""} et ${months} mois`
          : years > 0
            ? `${years} an${years > 1 ? "s" : ""}`
            : `${months} mois`;
      const suffix = data.prisonSuspended ? " avec sursis" : " de prison ferme";
      parts.push(duration + suffix);
    }
  }
  if (data.ineligibilityMonths !== null && data.ineligibilityMonths > 0) {
    const years = Math.floor(data.ineligibilityMonths / 12);
    const duration =
      years > 0 ? `${years} an${years > 1 ? "s" : ""}` : `${data.ineligibilityMonths} mois`;
    parts.push(`${duration} d'inéligibilité`);
  }
  if (data.communityService !== null && data.communityService > 0) {
    parts.push(`${data.communityService}h de travail d'intérêt général`);
  }
  if (data.otherSentence) {
    parts.push(data.otherSentence.toLowerCase());
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

async function main() {
  const wikidataService = new WikidataService();

  const politicians = await db.politician.findMany({
    where: {
      externalIds: { some: { source: "WIKIDATA" } },
      affairs: { some: { publicationStatus: "PUBLISHED" } },
    },
    select: {
      id: true,
      fullName: true,
      externalIds: { where: { source: "WIKIDATA" }, select: { externalId: true } },
      affairs: {
        where: { publicationStatus: { in: ["PUBLISHED", "DRAFT"] } },
        select: {
          id: true,
          title: true,
          category: true,
          prisonMonths: true,
          prisonSuspended: true,
          ineligibilityMonths: true,
          communityService: true,
          otherSentence: true,
          verdictDate: true,
          court: true,
          sentence: true,
        },
      },
    },
  });

  console.log(`${isDryRun ? "[DRY RUN] " : ""}Processing ${politicians.length} politicians...\n`);
  let updated = 0;
  let skipped = 0;

  for (const politician of politicians) {
    const qid = politician.externalIds[0]?.externalId;
    if (!qid) continue;

    try {
      const entities = await wikidataService.getEntities([qid]);
      const entity = entities.get(qid);
      if (!entity) continue;

      const claims = entity.claims[WD_PROPS.CONVICTED_OF] ?? [];

      for (const claim of claims) {
        const value = claim.mainsnak?.datavalue?.value;
        if (!value || typeof value !== "object" || !("id" in value)) continue;

        const penaltyData = extractPenaltyData(claim);
        if (Object.keys(penaltyData).length === 0) continue;

        const label = getOffenseLabel(value.id);
        const { category } = mapWikidataOffense(value.id, "P1399");

        // Resolve court Q-ID if present
        let courtLabel: string | null = null;
        if (penaltyData.courtQid) {
          const courtEntities = await wikidataService.getEntities(
            [penaltyData.courtQid],
            ["labels"]
          );
          courtLabel = courtEntities.get(penaltyData.courtQid)?.labels?.fr ?? null;
        }

        const matches = await findMatchingAffairs({
          politicianId: politician.id,
          title: `${label} — ${politician.fullName}`,
          category,
          verdictDate: penaltyData.verdictDate ?? null,
        });

        const bestMatch = matches.find(
          (m) => m.confidence === "CERTAIN" || m.confidence === "HIGH"
        );

        if (!bestMatch) {
          skipped++;
          continue;
        }

        const affair = politician.affairs.find((a) => a.id === bestMatch.affairId);
        if (!affair) {
          skipped++;
          continue;
        }

        // Only update fields that are currently NULL
        const updateData: Record<string, unknown> = {};
        if (penaltyData.prisonMonths !== undefined && affair.prisonMonths === null) {
          updateData.prisonMonths = penaltyData.prisonMonths;
          updateData.prisonSuspended = penaltyData.prisonSuspended ?? false;
        }
        if (penaltyData.verdictDate && !affair.verdictDate) {
          updateData.verdictDate = penaltyData.verdictDate;
        }
        if (penaltyData.ineligibilityMonths !== undefined && affair.ineligibilityMonths === null) {
          updateData.ineligibilityMonths = penaltyData.ineligibilityMonths;
        }
        if (penaltyData.otherSentence && !affair.otherSentence) {
          updateData.otherSentence = penaltyData.otherSentence;
        }
        if (courtLabel && !affair.court) {
          updateData.court = courtLabel;
        }

        // Build sentence summary if we have penalty data and affair has none
        if (Object.keys(updateData).length > 0 && !affair.sentence) {
          const mergedData = {
            prisonMonths: (updateData.prisonMonths as number | null) ?? affair.prisonMonths,
            prisonSuspended:
              (updateData.prisonSuspended as boolean | null) ?? affair.prisonSuspended,
            ineligibilityMonths:
              (updateData.ineligibilityMonths as number | null) ?? affair.ineligibilityMonths,
            communityService: affair.communityService,
            otherSentence: (updateData.otherSentence as string | null) ?? affair.otherSentence,
          };
          const sentence = buildSentenceSummary(mergedData);
          if (sentence) updateData.sentence = sentence;
        }

        if (Object.keys(updateData).length === 0) {
          skipped++;
          continue;
        }

        if (isDryRun) {
          console.log(`  [DRY RUN] ${politician.fullName}: ${affair.title}`);
          console.log(`    Would update: ${JSON.stringify(updateData)}`);
        } else {
          await db.affair.update({
            where: { id: bestMatch.affairId },
            data: updateData,
          });
          console.log(`  Updated: ${politician.fullName} — ${affair.title}`);
          console.log(`    ${JSON.stringify(updateData)}`);
        }
        updated++;
      }
    } catch (error) {
      console.error(`  Error for ${politician.fullName}: ${error}`);
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await db.$disconnect();
}

main().catch(console.error);
