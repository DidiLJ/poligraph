import type { MeasureSubtopicAssignmentStatus, ThemeCategory } from "@/generated/prisma";
import {
  getMeasureSubtopicsForTheme,
  MEASURE_SUBTOPIC_TAXONOMY_VERSION,
  MEASURE_SUBTOPICS,
} from "@/config/measure-subtopics";
import { callAnthropic, extractToolUse } from "@/lib/api/anthropic";
import { db } from "@/lib/db";
import { MeasureValidationError } from "@/lib/measures/errors";

const CLASSIFIER_MODEL = "claude-haiku-4-5-20251001";
export const MEASURE_SUBTOPIC_CLASSIFIER_VERSION = `${CLASSIFIER_MODEL}:v1`;

function sanitizeMeasureText(value: string): string {
  return value
    .replace(/["\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2_000);
}

export async function syncMeasureSubtopicTaxonomy(): Promise<void> {
  for (const subtopic of MEASURE_SUBTOPICS) {
    await db.measureSubtopic.upsert({
      where: { slug: subtopic.slug },
      create: {
        slug: subtopic.slug,
        label: subtopic.label,
        description: subtopic.description,
        theme: subtopic.theme,
        aliases: subtopic.aliases,
        sortOrder: subtopic.sortOrder,
      },
      update: {
        label: subtopic.label,
        description: subtopic.description,
        theme: subtopic.theme,
        aliases: subtopic.aliases,
        sortOrder: subtopic.sortOrder,
        active: true,
      },
    });
  }
}

type SuggestedSubtopic = { slug: string; confidence: number };

async function classifySubtopics(text: string, theme: ThemeCategory): Promise<SuggestedSubtopic[]> {
  const allowed = getMeasureSubtopicsForTheme(theme);
  if (allowed.length === 0) return [];

  const tools = [
    {
      name: "classify_measure_subtopics",
      description: "Propose de zéro à trois sous-sujets dans la taxonomie imposée.",
      input_schema: {
        type: "object" as const,
        properties: {
          subtopics: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                slug: { type: "string", enum: allowed.map((item) => item.slug) },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["slug", "confidence"],
            },
          },
        },
        required: ["subtopics"],
      },
    },
  ];
  const vocabulary = allowed
    .map((item) => `${item.slug}: ${item.label}. ${item.description}`)
    .join("\n");
  const prompt = `Classe uniquement le texte de mesure fourni. N'infère ni parti, ni candidat, ni intention. Utilise zéro à trois sous-sujets parmi la liste fermée. Ne choisis rien si le texte est trop vague.

<taxonomie>
${vocabulary}
</taxonomie>

<mesure>
${sanitizeMeasureText(text)}
</mesure>`;

  const response = await callAnthropic([{ role: "user", content: prompt }], {
    model: CLASSIFIER_MODEL,
    maxTokens: 300,
    tools,
    toolChoice: { type: "tool", name: "classify_measure_subtopics" },
  });
  const input = extractToolUse(response) as { subtopics?: SuggestedSubtopic[] } | null;
  const allowedSlugs = new Set(allowed.map((item) => item.slug));

  return (input?.subtopics ?? [])
    .filter(
      (item) =>
        allowedSlugs.has(item.slug) &&
        Number.isFinite(item.confidence) &&
        item.confidence >= 0 &&
        item.confidence <= 1
    )
    .filter((item, index, all) => all.findIndex((other) => other.slug === item.slug) === index)
    .slice(0, 3);
}

export type ProposeSubtopicsResult = {
  revisionId: string;
  suggestions: SuggestedSubtopic[];
  skipped: boolean;
};

export async function proposeMeasureRevisionSubtopics(
  revisionId: string,
  options: { dryRun?: boolean; proposedBy?: string; skipTaxonomySync?: boolean } = {}
): Promise<ProposeSubtopicsResult> {
  const revision = await db.measureRevision.findUnique({
    where: { id: revisionId },
    select: {
      id: true,
      text: true,
      measure: { select: { theme: true } },
      subtopics: { select: { subtopic: { select: { slug: true } }, status: true } },
    },
  });
  if (!revision) throw new MeasureValidationError("Révision introuvable");

  const fixedSlugs = new Set(
    revision.subtopics
      .filter((item) => item.status !== "SUGGESTED")
      .map((item) => item.subtopic.slug)
  );
  const hasApproved = revision.subtopics.some((item) => item.status === "APPROVED");
  if (hasApproved) return { revisionId, suggestions: [], skipped: true };

  const suggestions = (await classifySubtopics(revision.text, revision.measure.theme)).filter(
    (item) => !fixedSlugs.has(item.slug)
  );
  if (options.dryRun) return { revisionId, suggestions, skipped: false };

  if (!options.skipTaxonomySync) await syncMeasureSubtopicTaxonomy();
  const rows = await db.measureSubtopic.findMany({
    where: { slug: { in: suggestions.map((item) => item.slug) }, active: true },
    select: { id: true, slug: true },
  });
  const ids = new Map(rows.map((row) => [row.slug, row.id]));

  await db.$transaction(async (tx) => {
    await tx.measureRevisionSubtopic.deleteMany({
      where: { revisionId, status: "SUGGESTED" },
    });
    if (suggestions.length > 0) {
      await tx.measureRevisionSubtopic.createMany({
        data: suggestions.flatMap((suggestion) => {
          const subtopicId = ids.get(suggestion.slug);
          return subtopicId
            ? [
                {
                  revisionId,
                  subtopicId,
                  status: "SUGGESTED" as const,
                  confidence: suggestion.confidence,
                  method: "AI_ASSISTED",
                  classifierVersion: MEASURE_SUBTOPIC_CLASSIFIER_VERSION,
                  taxonomyVersion: MEASURE_SUBTOPIC_TAXONOMY_VERSION,
                },
              ]
            : [];
        }),
        skipDuplicates: true,
      });
    }
    await tx.auditLog.create({
      data: {
        action: "PROPOSE_SUBTOPICS",
        entityType: "MeasureRevision",
        entityId: revisionId,
        changes: {
          slugs: suggestions.map((suggestion) => suggestion.slug),
          classifierVersion: MEASURE_SUBTOPIC_CLASSIFIER_VERSION,
          taxonomyVersion: MEASURE_SUBTOPIC_TAXONOMY_VERSION,
        },
        userId: options.proposedBy ?? "system",
      },
    });
  });

  return { revisionId, suggestions, skipped: false };
}

export async function reviewMeasureRevisionSubtopic(input: {
  revisionId: string;
  subtopicId: string;
  status: Extract<MeasureSubtopicAssignmentStatus, "APPROVED" | "REJECTED">;
  reviewedBy: string;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    const assignment = await tx.measureRevisionSubtopic.findUnique({
      where: {
        revisionId_subtopicId: {
          revisionId: input.revisionId,
          subtopicId: input.subtopicId,
        },
      },
      select: { status: true },
    });
    if (!assignment || assignment.status !== "SUGGESTED") {
      throw new MeasureValidationError("Cette proposition a déjà été traitée");
    }

    await tx.measureRevisionSubtopic.update({
      where: {
        revisionId_subtopicId: {
          revisionId: input.revisionId,
          subtopicId: input.subtopicId,
        },
      },
      data: {
        status: input.status,
        reviewedAt: new Date(),
        reviewedBy: input.reviewedBy,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "REVIEW_SUBTOPIC",
        entityType: "MeasureRevision",
        entityId: input.revisionId,
        changes: { subtopicId: input.subtopicId, status: input.status },
        userId: input.reviewedBy,
      },
    });
  });
}
