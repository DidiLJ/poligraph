/**
 * Cleanup false-positive press mentions.
 *
 * Applies the same filtering logic as the updated press sync:
 * 1. Articles without political context → remove last-name-only mentions
 * 2. Articles with > MAX last-name-only mentions → remove all last-name-only
 *
 * Usage:
 *   npx tsx scripts/cleanup-press-mentions.ts          # dry run
 *   npx tsx scripts/cleanup-press-mentions.ts --apply   # actually delete
 */

import { db } from "@/lib/db";
import { isPoliticallyRelevant } from "@/config/press-keywords";

const MAX_LASTNAME_ONLY = 8;
const apply = process.argv.includes("--apply");

async function main() {
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN (use --apply to delete)"}\n`);

  // Fetch all articles that have at least one last-name-only mention
  const articles = await db.pressArticle.findMany({
    where: {
      mentions: { some: {} },
    },
    select: {
      id: true,
      title: true,
      description: true,
      mentions: {
        select: { id: true, matchedName: true },
      },
    },
  });

  let articlesScanned = 0;
  let articlesAffected = 0;
  let mentionsToDelete: string[] = [];
  let reasonNonPolitical = 0;
  let reasonCap = 0;

  for (const article of articles) {
    articlesScanned++;
    const searchText = `${article.title} ${article.description || ""}`;
    const lastnameOnly = article.mentions.filter(
      (m) => m.matchedName && !m.matchedName.includes(" ")
    );

    if (lastnameOnly.length === 0) continue;

    const isRelevant = isPoliticallyRelevant(searchText);
    let toRemove: typeof lastnameOnly = [];

    if (!isRelevant) {
      // Non-political article: remove all last-name-only mentions
      toRemove = lastnameOnly;
      reasonNonPolitical += toRemove.length;
    } else if (lastnameOnly.length > MAX_LASTNAME_ONLY) {
      // Political but too many last-name-only matches: remove all last-name-only
      toRemove = lastnameOnly;
      reasonCap += toRemove.length;
    }

    if (toRemove.length > 0) {
      articlesAffected++;
      mentionsToDelete.push(...toRemove.map((m) => m.id));

      if (articlesAffected <= 20) {
        const reason = !isRelevant ? "NON-POLITICAL" : "CAP EXCEEDED";
        console.log(
          `[${reason}] ${article.title.slice(0, 70)}... → ${toRemove.length} mention(s) to remove`
        );
        for (const m of toRemove.slice(0, 5)) {
          console.log(`  - ${m.matchedName}`);
        }
        if (toRemove.length > 5) console.log(`  ... and ${toRemove.length - 5} more`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Articles scanned: ${articlesScanned}`);
  console.log(`Articles affected: ${articlesAffected}`);
  console.log(`Mentions to delete: ${mentionsToDelete.length}`);
  console.log(`  - Non-political context: ${reasonNonPolitical}`);
  console.log(`  - Cap exceeded (>${MAX_LASTNAME_ONLY}): ${reasonCap}`);

  if (apply && mentionsToDelete.length > 0) {
    console.log(`\nDeleting ${mentionsToDelete.length} mentions...`);
    const result = await db.pressArticleMention.deleteMany({
      where: { id: { in: mentionsToDelete } },
    });
    console.log(`Deleted: ${result.count}`);
  } else if (mentionsToDelete.length > 0) {
    console.log("\nRe-run with --apply to delete.");
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
