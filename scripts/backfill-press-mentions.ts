/**
 * Backfill press mentions: remove false positives from compound first name collisions.
 *
 * Checks each existing mention: if the politician's full name was written with hyphens
 * in the original article text (e.g. "Jean-Michel Aulas"), it's a compound first name,
 * not our politician "Jean Michel" — and the mention is a false positive.
 *
 * Complexity: O(mentions) — scales to 1M+ articles.
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/backfill-press-mentions.ts          # dry run
 *   npx dotenv -e .env -- npx tsx scripts/backfill-press-mentions.ts --apply  # actually apply
 */

import { db } from "@/lib/db";
import { normalizeText, escapeRegex } from "@/lib/name-matching";

const BATCH_SIZE = 1000;
const apply = process.argv.includes("--apply");

function wasOriginallyHyphenated(originalText: string, normalizedFullName: string): boolean {
  const parts = normalizedFullName.split(/\s+/);
  if (parts.length < 2) return false;

  const lowerOriginal = originalText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const hyphenPattern = parts.map(escapeRegex).join("[-–—]");
  return new RegExp(`\\b${hyphenPattern}\\b`).test(lowerOriginal);
}

async function main() {
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN (use --apply to delete)"}\n`);

  const politicians = await db.politician.findMany({
    where: { publicationStatus: "PUBLISHED" },
    select: { id: true, fullName: true },
  });

  const nameMap = new Map<string, { normalizedFullName: string; fullName: string }>();
  for (const p of politicians) {
    const normalized = normalizeText(p.fullName);
    const wordCount = normalized.split(/\s+/).length;
    if (wordCount <= 3) {
      nameMap.set(p.id, { normalizedFullName: normalized, fullName: p.fullName });
    }
  }
  console.log(`Politicians total: ${politicians.length}, at-risk (≤3 words): ${nameMap.size}\n`);

  let totalMentions = 0;
  let checked = 0;
  const falsePositives: string[] = [];
  const samples: Array<{ name: string; title: string }> = [];

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const mentions = await db.pressArticleMention.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        politicianId: true,
        article: { select: { title: true, description: true } },
      },
    });

    if (mentions.length === 0) break;
    hasMore = mentions.length === BATCH_SIZE;
    cursor = mentions[mentions.length - 1]!.id;
    totalMentions += mentions.length;

    for (const mention of mentions) {
      const politician = nameMap.get(mention.politicianId);
      if (!politician) continue;

      checked++;
      const searchText = `${mention.article.title} ${mention.article.description || ""}`;

      if (wasOriginallyHyphenated(searchText, politician.normalizedFullName)) {
        falsePositives.push(mention.id);
        if (samples.length < 20) {
          samples.push({
            name: politician.fullName,
            title: mention.article.title ?? "(sans titre)",
          });
        }
      }
    }

    process.stdout.write(`\r  Scanned ${totalMentions} mentions (${checked} checked)...`);
  }

  console.log("\n\n" + "=".repeat(60));
  console.log(`Total mentions scanned: ${totalMentions}`);
  console.log(`At-risk mentions checked: ${checked}`);
  console.log(`False positives found: ${falsePositives.length}`);

  if (samples.length > 0) {
    console.log("\nSamples:");
    for (const s of samples) {
      console.log(`  - "${s.name}" in: ${s.title.slice(0, 80)}`);
    }
  }

  if (apply && falsePositives.length > 0) {
    console.log(`\nDeleting ${falsePositives.length} false positive mentions...`);
    const deleted = await db.pressArticleMention.deleteMany({
      where: { id: { in: falsePositives } },
    });
    console.log(`Deleted: ${deleted.count}`);
  } else if (falsePositives.length > 0) {
    console.log("\nRe-run with --apply to delete.");
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
