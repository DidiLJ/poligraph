import { db } from "@/lib/db";
import { parseScrutinTitle } from "./link-scrutins-to-amendments/parse-title";
import { resolveLinks } from "./link-scrutins-to-amendments/resolve";
import { writeScrutinAmendments } from "./link-scrutins-to-amendments/writer";
import type { LinkScrutinsOptions, LinkScrutinsStats } from "./link-scrutins-to-amendments/types";
import type { ScrutinAmendmentRole } from "@/generated/prisma";

const EMPTY_ROLE_COUNTS: Record<ScrutinAmendmentRole, number> = {
  PRINCIPAL: 0,
  SUB_AMENDMENT: 0,
  PARENT_AMENDMENT: 0,
  IDENTICAL: 0,
  INFERRED: 0,
  UNKNOWN: 0,
};

/** Narrow projection of Scrutin — only the fields the linker needs. */
const SCRUTIN_SELECT = {
  id: true,
  externalId: true,
  title: true,
  dossierLegislatifId: true,
  legislature: true,
  chamber: true,
  votingDate: true,
} as const;

export async function linkScrutinsToAmendments(
  opts: LinkScrutinsOptions = {}
): Promise<LinkScrutinsStats> {
  const started = Date.now();
  const legislature = opts.legislature ?? 17;
  const chamber = opts.chamber ?? "AN";

  const stats: LinkScrutinsStats = {
    scrutinsScanned: 0,
    scrutinsWithAmendmentLookingTitle: 0,
    scrutinsWithDossierScope: 0,
    scrutinsLinked: 0,
    scrutinsUnscoped: 0,
    scrutinsAmbiguous: 0,
    scrutinsCandidateNotFound: 0,
    scrutinsUnresolved: 0,
    scrutinsNoAmendmentCited: 0,
    linksCreated: 0,
    linksSkippedDuplicate: 0,
    byRole: { ...EMPTY_ROLE_COUNTS },
    warnings: [],
    durationMs: 0,
  };

  const scrutins = await db.scrutin.findMany({
    where: {
      legislature,
      chamber,
      ...(opts.scrutinIds ? { id: { in: opts.scrutinIds } } : {}),
    },
    select: SCRUTIN_SELECT,
    take: opts.limit,
    orderBy: { votingDate: "desc" },
  });

  for (const scrutin of scrutins) {
    stats.scrutinsScanned++;
    if (scrutin.dossierLegislatifId) stats.scrutinsWithDossierScope++;

    const parsed = parseScrutinTitle(scrutin.title);

    const titleHasAmendment =
      parsed.principalNumbers.length > 0 ||
      parsed.subAmendmentNumber !== null ||
      parsed.identiqueNumbers.length > 0 ||
      parsed.hasIdentique;
    if (titleHasAmendment) stats.scrutinsWithAmendmentLookingTitle++;

    if (parsed.warnings.some((w) => w.code === "NO_AMENDMENT_CITED")) {
      stats.scrutinsNoAmendmentCited++;
      if (opts.verbose) console.log(`[link] ${scrutin.externalId} no amendment cited`);
      continue;
    }

    const res = await resolveLinks(scrutin, parsed);

    if (res.scope === "unscoped") {
      stats.scrutinsUnscoped++;
      stats.warnings.push({ scrutinId: scrutin.id, code: "UNSCOPED", message: scrutin.externalId });
      continue;
    }

    const hadAmbiguous = res.warnings.some((w) => w.code === "AMBIGUOUS_CANDIDATES");
    const hadNotFound = res.warnings.some((w) => w.code === "CANDIDATE_NOT_FOUND");
    if (hadAmbiguous) stats.scrutinsAmbiguous++;
    if (hadNotFound) stats.scrutinsCandidateNotFound++;

    if (res.links.length === 0) {
      stats.scrutinsUnresolved++;
      for (const w of res.warnings)
        stats.warnings.push({ scrutinId: scrutin.id, code: w.code, message: w.message });
      continue;
    }

    // res.links is ALREADY deduped by (scrutinId, amendmentId) inside resolveLinks.
    if (opts.dryRun) {
      const existing = await db.scrutinAmendment.count({
        where: { scrutinId: scrutin.id, amendmentId: { in: res.links.map((l) => l.amendmentId) } },
      });
      stats.linksSkippedDuplicate += existing;
      stats.linksCreated += res.links.length - existing;
    } else {
      const r = await writeScrutinAmendments(res.links);
      stats.linksCreated += r.created;
      stats.linksSkippedDuplicate += r.skipped;
    }

    for (const l of res.links) stats.byRole[l.role]++;
    stats.scrutinsLinked++;
  }

  stats.durationMs = Date.now() - started;
  return stats;
}
