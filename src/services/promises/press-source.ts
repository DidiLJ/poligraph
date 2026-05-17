import { db } from "@/lib/db";
import { extractPromisesFromText } from "./extractor";
import { classifyTheme } from "./theme-classifier";

interface IngestOptions {
  limit?: number;
  dryRun?: boolean;
}

export interface IngestResult {
  scanned: number;
  extracted: number;
  inserted: number;
}

export async function ingestPromisesFromPress(opts: IngestOptions = {}): Promise<IngestResult> {
  const limit = opts.limit ?? 50;

  const articles = await db.pressArticle.findMany({
    where: {
      mentions: { some: {} },
      promiseScanStatus: null,
    },
    include: {
      mentions: { include: { politician: true } },
    },
    take: limit,
    orderBy: { publishedAt: "desc" },
  });

  let extracted = 0;
  let inserted = 0;

  for (const article of articles) {
    let articleHadHit = false;
    for (const mention of article.mentions) {
      const candidates = await extractPromisesFromText({
        text: `${article.title}\n\n${article.description ?? ""}`,
        politicianName: mention.politician.fullName,
      });
      extracted += candidates.length;
      articleHadHit = articleHadHit || candidates.length > 0;

      if (opts.dryRun) continue;

      for (const candidate of candidates) {
        const classification = await classifyTheme(candidate.text);
        await db.promise.create({
          data: {
            politicianId: mention.politicianId,
            text: candidate.text,
            context: candidate.context ?? null,
            theme: classification.theme,
            themeConfidence: classification.confidence,
            sourceKind: "ARTICLE_PRESSE",
            sourceUrl: article.url,
            sourceLabel: article.feedSource,
            publishedAt: article.publishedAt,
            extractionStatus: "EXTRACTED",
            extractionMethod: classification.method,
            extractionConfidence: candidate.confidence,
          },
        });
        inserted++;
      }
    }

    if (!opts.dryRun) {
      await db.pressArticle.update({
        where: { id: article.id },
        data: {
          promiseScanStatus: articleHadHit ? "scanned" : "skipped",
          promiseScanAt: new Date(),
        },
      });
    }
  }

  return { scanned: articles.length, extracted, inserted };
}
