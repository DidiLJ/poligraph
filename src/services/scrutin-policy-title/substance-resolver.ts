import { ScrutinAmendmentRole } from "@/generated/prisma";
import { db } from "@/lib/db";
import { stripHtml } from "./strip-html";
import type {
  GenerationWarning,
  ResolvedSubstance,
  SubstanceDepth,
  SubstanceTextBlock,
} from "./types";

type ResolverAmendment = {
  id: string;
  content: string | null;
  summary: string | null;
  article: string | null;
  number: string;
  parentAmendmentId: string | null;
  identicalGroupKey: string | null;
  dossierId: string | null;
};

/**
 * Builds OFFICIAL substance blocks from a single amendment: one block per
 * non-empty `content` (Amendment.content) and `summary` (Amendment.summary).
 * Empty (or HTML-only) fields are skipped.
 */
function blocksFromAmendment(
  amd: ResolverAmendment,
  sourceType: SubstanceTextBlock["sourceType"]
): SubstanceTextBlock[] {
  const meta: SubstanceTextBlock["meta"] = {
    amendmentNumber: amd.number,
    articleRef: amd.article ?? undefined,
  };
  const blocks: SubstanceTextBlock[] = [];

  const contentText = amd.content ? stripHtml(amd.content) : "";
  if (contentText) {
    blocks.push({
      sourceType,
      sourceId: amd.id,
      field: "Amendment.content",
      text: contentText,
      trust: "official",
      meta,
    });
  }

  const summaryText = amd.summary ? stripHtml(amd.summary) : "";
  if (summaryText) {
    blocks.push({
      sourceType,
      sourceId: amd.id,
      field: "Amendment.summary",
      text: summaryText,
      trust: "official",
      meta,
    });
  }

  return blocks;
}

/**
 * Resolves the OFFICIAL substance sources for a scrutin into ordered, plain-text
 * blocks. Priority (deepest → shallowest): sub-amendments, then their parents,
 * then (only if no sub-amendments) the principal amendment(s), then identicals,
 * then the dossier's exposé des motifs. Scrutin.title / Scrutin.citizenImpact /
 * Scrutin.summary and the AI dossier summary are NEVER emitted as blocks.
 */
export async function resolveSubstanceSources(scrutinId: string): Promise<ResolvedSubstance> {
  const scrutin = await db.scrutin.findUnique({
    where: { id: scrutinId },
    select: {
      amendmentLinks: {
        select: {
          role: true,
          amendment: {
            select: {
              id: true,
              content: true,
              summary: true,
              article: true,
              number: true,
              parentAmendmentId: true,
              identicalGroupKey: true,
              dossierId: true,
            },
          },
        },
      },
      dossierLegislatif: { select: { id: true, exposeDesMotifs: true } },
    },
  });

  const warnings: GenerationWarning[] = [];

  if (!scrutin) {
    return {
      blocks: [],
      substanceDepth: null,
      warnings: [
        {
          code: "NO_SUBSTANCE_FOUND",
          severity: "blocker",
          message: `Scrutin ${scrutinId} not found.`,
        },
      ],
    };
  }

  const links = scrutin.amendmentLinks;
  const subLinks = links.filter((l) => l.role === ScrutinAmendmentRole.SUB_AMENDMENT);
  const parentLinks = links.filter((l) => l.role === ScrutinAmendmentRole.PARENT_AMENDMENT);
  const principalLinks = links.filter((l) => l.role === ScrutinAmendmentRole.PRINCIPAL);
  const identicalLinks = links.filter((l) => l.role === ScrutinAmendmentRole.IDENTICAL);

  const blocks: SubstanceTextBlock[] = [];
  let hasSubAmendmentBlock = false;
  let hasAmendmentLevelBlock = false;

  // a. Sub-amendment links.
  for (const link of subLinks) {
    const sub = blocksFromAmendment(link.amendment, "subAmendment");
    if (sub.length > 0) hasSubAmendmentBlock = true;
    blocks.push(...sub);
  }

  // b. Parents of sub-amendments (dedupe by amendment id; PARENT_AMENDMENT links
  //    may overlap with parents resolved via parentAmendmentId).
  if (subLinks.length > 0) {
    const emittedParentIds = new Set<string>();

    // Parents reachable through an explicit PARENT_AMENDMENT link.
    const parentLinkById = new Map<string, ResolverAmendment>();
    for (const link of parentLinks) parentLinkById.set(link.amendment.id, link.amendment);

    for (const link of subLinks) {
      const parentId = link.amendment.parentAmendmentId;
      if (!parentId || emittedParentIds.has(parentId)) continue;
      emittedParentIds.add(parentId);

      let parentAmd = parentLinkById.get(parentId) ?? null;
      if (!parentAmd) {
        parentAmd = await db.amendment.findUnique({
          where: { id: parentId },
          select: {
            id: true,
            content: true,
            summary: true,
            article: true,
            number: true,
            parentAmendmentId: true,
            identicalGroupKey: true,
            dossierId: true,
          },
        });
      }
      if (!parentAmd) continue;

      const parentBlocks = blocksFromAmendment(parentAmd, "parentAmendment");
      if (parentBlocks.length > 0) hasAmendmentLevelBlock = true;
      blocks.push(...parentBlocks);
    }

    // PARENT_AMENDMENT links that were not reached via a sub's parentAmendmentId.
    for (const link of parentLinks) {
      if (emittedParentIds.has(link.amendment.id)) continue;
      emittedParentIds.add(link.amendment.id);
      const parentBlocks = blocksFromAmendment(link.amendment, "parentAmendment");
      if (parentBlocks.length > 0) hasAmendmentLevelBlock = true;
      blocks.push(...parentBlocks);
    }
  }

  // c. Principal links (only when there are no sub-amendment links).
  if (subLinks.length === 0) {
    for (const link of principalLinks) {
      const principal = blocksFromAmendment(link.amendment, "amendment");
      if (principal.length > 0) hasAmendmentLevelBlock = true;
      blocks.push(...principal);
    }
  }

  // d. Identical links.
  for (const link of identicalLinks) {
    const identical = blocksFromAmendment(link.amendment, "identical");
    if (identical.length > 0) hasAmendmentLevelBlock = true;
    blocks.push(...identical);
  }

  // e. Dossier exposé des motifs (only when nothing else produced a block).
  let hasDossierBlock = false;
  if (blocks.length === 0 && scrutin.dossierLegislatif?.exposeDesMotifs) {
    const exposeText = stripHtml(scrutin.dossierLegislatif.exposeDesMotifs);
    if (exposeText) {
      hasDossierBlock = true;
      blocks.push({
        sourceType: "dossier",
        sourceId: scrutin.dossierLegislatif.id,
        field: "LegislativeDossier.exposeDesMotifs",
        text: exposeText,
        trust: "official",
      });
    }
  }

  let substanceDepth: SubstanceDepth | null;
  if (hasSubAmendmentBlock) {
    substanceDepth = "subAmendment";
  } else if (hasAmendmentLevelBlock) {
    substanceDepth = "amendment";
  } else if (hasDossierBlock) {
    substanceDepth = "exposeDesMotifs";
  } else {
    substanceDepth = null;
  }

  if (blocks.length === 0) {
    substanceDepth = null;
    warnings.push({
      code: "NO_SUBSTANCE_FOUND",
      severity: "blocker",
      message: `No official substance text found for scrutin ${scrutinId}.`,
    });
  }

  return { blocks, substanceDepth, warnings };
}
