import { db } from "@/lib/db";
import type { ParsedTitle, LinkResolution, ResolvedLink, ParserWarning } from "./types";

const PARSER_FLOOR = 0.2;

/** Minimal scrutin shape consumed by the resolver. */
export interface ScrutinForLink {
  id: string;
  title: string;
  dossierLegislatifId: string | null;
}

export async function resolveLinks(
  scrutin: ScrutinForLink,
  parsed: ParsedTitle
): Promise<LinkResolution> {
  const warnings: ParserWarning[] = [...parsed.warnings];
  let confidence = parsed.confidence;
  const links: ResolvedLink[] = [];

  if (!scrutin.dossierLegislatifId) {
    warnings.push({
      code: "UNSCOPED",
      message: "Scrutin has no dossierLegislatifId — TITLE_REGEX cannot scope candidates safely.",
    });
    return {
      scrutinId: scrutin.id,
      links: [],
      warnings,
      parserConfidence: PARSER_FLOOR,
      scope: "unscoped",
    };
  }

  const cited: {
    role: "PRINCIPAL" | "SUB_AMENDMENT" | "PARENT_AMENDMENT" | "IDENTICAL";
    number: string;
  }[] = [];
  if (parsed.subAmendmentNumber)
    cited.push({ role: "SUB_AMENDMENT", number: parsed.subAmendmentNumber });
  if (parsed.parentAmendmentNumber)
    cited.push({ role: "PARENT_AMENDMENT", number: parsed.parentAmendmentNumber });
  for (const n of parsed.principalNumbers) cited.push({ role: "PRINCIPAL", number: n });
  for (const n of parsed.identiqueNumbers) cited.push({ role: "IDENTICAL", number: n });

  const allNumbers = [...new Set(cited.map((c) => c.number))];
  const candidates = allNumbers.length
    ? await db.amendment.findMany({
        where: { dossierId: scrutin.dossierLegislatifId, number: { in: allNumbers } },
        select: { id: true, number: true, identicalGroupKey: true, texteRef: true },
      })
    : [];
  const byNumber = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const arr = byNumber.get(c.number) ?? [];
    arr.push(c);
    byNumber.set(c.number, arr);
  }

  const unmatched = allNumbers.filter((n) => !byNumber.has(n));
  type Candidate = (typeof candidates)[number];
  const variantsByNumber = new Map<string, Candidate[]>();
  for (const n of unmatched) {
    const variants = await db.amendment.findMany({
      where: { dossierId: scrutin.dossierLegislatifId, number: { startsWith: `${n} (` } },
      select: { id: true, number: true, identicalGroupKey: true, texteRef: true },
    });
    if (variants.length > 0) variantsByNumber.set(n, variants);
  }

  for (const { role, number } of cited) {
    const exact = byNumber.get(number) ?? [];

    if (exact.length === 1) {
      const picked = exact[0]!;
      links.push({
        scrutinId: scrutin.id,
        amendmentId: picked.id,
        role,
        parserConfidence: confidence,
        parserWarnings: [],
      });
      continue;
    }
    if (exact.length > 1) {
      warnings.push({
        code: "AMBIGUOUS_CANDIDATES",
        message: `Amendment n° ${number} (${role}) has ${exact.length} exact candidates in dossier scope: ${exact.map((c) => c.id).join(", ")}.`,
      });
      confidence -= 0.2;
      continue;
    }
    const variants = variantsByNumber.get(number) ?? [];
    if (variants.length === 1) {
      const picked = variants[0]!;
      links.push({
        scrutinId: scrutin.id,
        amendmentId: picked.id,
        role,
        parserConfidence: Math.max(PARSER_FLOOR, confidence - 0.1),
        parserWarnings: [
          {
            code: "RECTIFIED_VARIANT",
            message: `matched title "${number}" to candidate "${picked.number}"`,
          },
        ],
      });
      continue;
    }
    if (variants.length > 1) {
      warnings.push({
        code: "AMBIGUOUS_CANDIDATES",
        message: `Amendment n° ${number} (${role}) has ${variants.length} rectified-variant candidates in dossier scope: ${variants.map((c) => `${c.number}=${c.id}`).join(", ")}.`,
      });
      confidence -= 0.2;
      continue;
    }
    warnings.push({
      code: "CANDIDATE_NOT_FOUND",
      message: `Amendment n° ${number} (${role}) not found in dossier scope.`,
    });
    confidence -= 0.15;
  }

  if (parsed.hasIdentique && parsed.identiqueNumbers.length === 0) {
    const anchor =
      links.find((l) => l.role === "PARENT_AMENDMENT") ??
      links.find((l) => l.role === "PRINCIPAL") ??
      links.find((l) => l.role === "SUB_AMENDMENT");
    if (anchor) {
      const anchorRow = candidates.find((c) => c.id === anchor.amendmentId);
      const groupKey = anchorRow?.identicalGroupKey ?? null;
      if (groupKey) {
        const groupMembers = await db.amendment.findMany({
          where: {
            identicalGroupKey: groupKey,
            dossierId: scrutin.dossierLegislatifId,
            NOT: { id: anchor.amendmentId },
          },
          select: { id: true },
        });
        for (const m of groupMembers) {
          links.push({
            scrutinId: scrutin.id,
            amendmentId: m.id,
            role: "IDENTICAL",
            parserConfidence: confidence,
            parserWarnings: [],
          });
        }
      }
    }
  }

  // GUARD: a sous-amendement vote's real target is the SUB_AMENDMENT. If cited
  // but not resolved, drop ALL production links to avoid a misleading link.
  if (parsed.subAmendmentNumber && !links.some((l) => l.role === "SUB_AMENDMENT")) {
    warnings.push({
      code: "TARGET_SUB_AMENDMENT_NOT_FOUND",
      message: `Sous-amendement n° ${parsed.subAmendmentNumber} (the vote target) was not resolved in dossier scope; parent/identical links dropped to avoid a misleading link.`,
    });
    return {
      scrutinId: scrutin.id,
      links: [],
      warnings,
      parserConfidence: PARSER_FLOOR,
      scope: "dossier",
    };
  }

  const dedupedLinks = dedupeLinks(links);

  return {
    scrutinId: scrutin.id,
    links: dedupedLinks,
    warnings,
    parserConfidence: Math.max(PARSER_FLOOR, confidence),
    scope: "dossier",
  };
}

/**
 * Role priority for collapsing duplicate (scrutinId, amendmentId) pairs.
 * SUB_AMENDMENT (the thing actually voted) > PRINCIPAL > PARENT_AMENDMENT >
 * IDENTICAL > INFERRED > UNKNOWN (last two never written in V1).
 */
const ROLE_PRIORITY: Record<string, number> = {
  SUB_AMENDMENT: 0,
  PRINCIPAL: 1,
  PARENT_AMENDMENT: 2,
  IDENTICAL: 3,
  INFERRED: 4,
  UNKNOWN: 5,
};

export function dedupeLinks(links: ResolvedLink[]): ResolvedLink[] {
  const byAmendment = new Map<string, ResolvedLink>();
  for (const link of links) {
    const existing = byAmendment.get(link.amendmentId);
    if (!existing) {
      byAmendment.set(link.amendmentId, link);
      continue;
    }
    const better =
      ROLE_PRIORITY[link.role]! < ROLE_PRIORITY[existing.role]! ||
      (ROLE_PRIORITY[link.role]! === ROLE_PRIORITY[existing.role]! &&
        link.parserConfidence > existing.parserConfidence);
    if (better) byAmendment.set(link.amendmentId, link);
  }
  return [...byAmendment.values()];
}
