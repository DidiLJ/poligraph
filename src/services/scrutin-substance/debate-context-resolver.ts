/**
 * READ-ONLY resolver around the pure `findAmendmentMention` matcher. For a
 * scrutin, it gathers the same-day candidate transcripts and returns the best
 * mention with a bounded excerpt and a confidence. NO model call, NO DB write.
 *
 * PROVISIONAL: depends on the per-séance transcript linkage (a transcript is
 * stored per day) and on the matcher's regex, both still to be hardened. Use for
 * read-only audit only; do NOT wire into generation yet.
 */
import { db } from "@/lib/db";
import {
  findAmendmentMention,
  type AmendmentRef,
  type AmendmentMention,
  type DebateContextConfidence,
} from "./debate-context";

export interface DebateContextResult extends AmendmentMention {
  scrutinId: string;
  transcriptSeanceRef: string | null;
  hasCandidateTranscript: boolean;
}

const RANK: Record<DebateContextConfidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };

/** First author's surname, cleaned of AN HTML entities and civility prefix. */
export function extractAuthorSurname(authorName: string | null | undefined): string | null {
  if (!authorName) return null;
  const cleaned = authorName
    .replace(/&#160;|&nbsp;/gi, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const first = cleaned.split(",")[0]?.trim() ?? "";
  const noCiv = first.replace(/^(mmes?|mm\.?|m\.?|mlle)\s+/i, "").trim();
  return noCiv.length >= 3 ? noCiv : null;
}

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function resolveDebateContextForScrutin(
  scrutinId: string
): Promise<DebateContextResult> {
  const scrutin = await db.scrutin.findUnique({
    where: { id: scrutinId },
    select: {
      votingDate: true,
      amendmentLinks: {
        select: { amendment: { select: { number: true, authorName: true, article: true } } },
      },
    },
  });

  const base: DebateContextResult = {
    scrutinId,
    confidence: "NONE",
    reason: "Aucune mention claire de l'amendement dans le débat.",
    excerpt: null,
    matchedAmendmentNumber: null,
    usableForGeneration: false,
    transcriptSeanceRef: null,
    hasCandidateTranscript: false,
  };

  if (!scrutin) return base;

  const refs: AmendmentRef[] = scrutin.amendmentLinks.map((l) => ({
    number: l.amendment.number,
    authorSurname: extractAuthorSurname(l.amendment.authorName),
    article: l.amendment.article,
  }));
  if (refs.length === 0) return base;

  const { start, end } = dayBounds(scrutin.votingDate);
  const candidates = await db.debateTranscript.findMany({
    where: { date: { gte: start, lte: end } },
    select: { seanceRef: true, content: true },
  });

  base.hasCandidateTranscript = candidates.length > 0;

  let best = base;
  for (const t of candidates) {
    const m = findAmendmentMention(t.content, refs);
    if (RANK[m.confidence] > RANK[best.confidence]) {
      best = { ...base, ...m, transcriptSeanceRef: t.seanceRef };
    }
  }
  return best;
}

export interface DebateContextAuditRow {
  scrutinId: string;
  slug: string | null;
  amendment: string;
  hasCandidateTranscript: boolean;
  confidence: DebateContextConfidence;
  usableForGeneration: boolean;
  reason: string;
  excerpt: string | null;
}

export interface DebateContextAudit {
  scanned: number;
  byConfidence: Record<DebateContextConfidence, number>;
  rows: DebateContextAuditRow[];
}

/**
 * READ-ONLY audit over amendment-linked scrutins that already have an analysis.
 * For each, reports whether a candidate transcript exists and how strongly it
 * mentions the voted amendment. No write, no model call.
 */
export async function auditDebateContextForAmendmentAnalyses(options?: {
  limit?: number;
}): Promise<DebateContextAudit> {
  const scrutins = await db.scrutin.findMany({
    where: { amendmentLinks: { some: {} }, analysis: { isNot: null } },
    orderBy: { votingDate: "desc" },
    select: {
      id: true,
      slug: true,
      amendmentLinks: { select: { amendment: { select: { number: true } } }, take: 1 },
    },
    ...(options?.limit ? { take: options.limit } : {}),
  });

  const byConfidence: Record<DebateContextConfidence, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    NONE: 0,
  };
  const rows: DebateContextAuditRow[] = [];

  for (const s of scrutins) {
    const ctx = await resolveDebateContextForScrutin(s.id);
    byConfidence[ctx.confidence]++;
    rows.push({
      scrutinId: s.id,
      slug: s.slug,
      amendment: s.amendmentLinks[0]?.amendment.number ?? "?",
      hasCandidateTranscript: ctx.hasCandidateTranscript,
      confidence: ctx.confidence,
      usableForGeneration: ctx.usableForGeneration,
      reason: ctx.reason,
      excerpt: ctx.excerpt,
    });
  }

  return { scanned: scrutins.length, byConfidence, rows };
}
