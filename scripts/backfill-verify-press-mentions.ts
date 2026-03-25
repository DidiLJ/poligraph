/**
 * Backfill: re-verify existing press mentions with Mistral AI.
 *
 * Loads all press articles with mentions, runs AI verification,
 * and deletes mentions that are false positives.
 *
 * Usage:
 *   npx tsx scripts/backfill-verify-press-mentions.ts          # dry run
 *   npx tsx scripts/backfill-verify-press-mentions.ts --apply   # apply deletions
 *   npx tsx scripts/backfill-verify-press-mentions.ts --limit 100  # process 100 articles
 */

import { db } from "@/lib/db";
import { MANDATE_TYPE_LABELS } from "@/config/labels";
import type { MandateType } from "@/generated/prisma";
import { verifyMentions } from "@/services/sync/press-mention-verify";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] || "0", 10) : 0;

async function main() {
  console.log(`Press mention backfill verification (${apply ? "APPLY" : "DRY RUN"})`);

  // Build role map
  const mandates = await db.mandate.findMany({
    where: { isCurrent: true },
    select: { politicianId: true, type: true },
  });
  const roleMap = new Map<string, string>();
  for (const m of mandates) {
    if (!roleMap.has(m.politicianId)) {
      roleMap.set(m.politicianId, MANDATE_TYPE_LABELS[m.type as MandateType] ?? m.type);
    }
  }

  // Load articles with mentions
  const articles = await db.pressArticle.findMany({
    where: { mentions: { some: {} } },
    select: {
      id: true,
      title: true,
      description: true,
      mentions: {
        select: {
          id: true,
          politicianId: true,
          matchedName: true,
        },
      },
    },
    orderBy: { publishedAt: "desc" },
    ...(limit > 0 ? { take: limit } : {}),
  });

  console.log(`Found ${articles.length} articles with mentions`);

  let totalMentions = 0;
  let rejectedMentions = 0;
  let deletedMentions = 0;
  const falsePositives: Array<{ title: string; name: string; role: string }> = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i]!;
    totalMentions += article.mentions.length;

    const results = await verifyMentions({
      articleTitle: article.title,
      articleDescription: article.description || "",
      mentions: article.mentions.map((m) => ({
        politicianId: m.politicianId,
        matchedName: m.matchedName ?? m.politicianId,
        role: roleMap.get(m.politicianId) ?? "politicien",
      })),
    });

    const rejected = results.filter((r) => !r.confirmed);
    if (rejected.length > 0) {
      rejectedMentions += rejected.length;

      for (const r of rejected) {
        const mention = article.mentions.find((m) => m.politicianId === r.politicianId);
        const role = roleMap.get(r.politicianId) ?? "politicien";
        falsePositives.push({ title: article.title, name: r.matchedName, role });

        if (apply && mention) {
          await db.pressArticleMention.delete({ where: { id: mention.id } });
          deletedMentions++;
        }
      }
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  Processed ${i + 1}/${articles.length} articles...`);
    }
  }

  console.log("\n--- Results ---");
  console.log(`Articles processed: ${articles.length}`);
  console.log(`Total mentions: ${totalMentions}`);
  console.log(`False positives detected: ${rejectedMentions}`);
  if (apply) {
    console.log(`Mentions deleted: ${deletedMentions}`);
  }

  if (falsePositives.length > 0) {
    console.log("\nFalse positives:");
    for (const fp of falsePositives.slice(0, 50)) {
      console.log(`  "${fp.title}" -> ${fp.name} (${fp.role})`);
    }
    if (falsePositives.length > 50) {
      console.log(`  ... and ${falsePositives.length - 50} more`);
    }
  }

  if (!apply && rejectedMentions > 0) {
    console.log(`\nRun with --apply to delete ${rejectedMentions} false positive mentions`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
