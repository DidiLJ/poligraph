/**
 * Service to download parliamentary documents and extract their exposé des motifs.
 *
 * Source: the Assemblée nationale open data document endpoint,
 * `https://www.assemblee-nationale.fr/dyn/opendata/{uid}.html`, which serves the
 * full text of a bill or report keyed by the same uid as `documentExternalId`.
 *
 * It replaces docparl.assemblee-nationale.fr, which served the same documents as
 * .docx until the host was removed from DNS: every request then failed with
 * `getaddrinfo ENOTFOUND`, and the daily sync stopped importing exposés.
 */

import { db } from "@/lib/db";
import { extractBlockText } from "@/lib/parsing/html-block-text";
import { ASSEMBLEE_OPENDATA_RATE_LIMIT_MS } from "@/config/rate-limits";
import {
  HTTPClient,
  HTTPError,
  describeError,
  isUnresolvableHostError,
} from "@/lib/api/http-client";

export const DOCUMENT_HOST = "www.assemblee-nationale.fr";

const DOCUMENT_URL_TEMPLATE = `https://${DOCUMENT_HOST}/dyn/opendata/{id}.html`;

/** Value written to `LegislativeDossier.exposeSource` for this pipeline. */
export const EXPOSE_SOURCE = "an-opendata";

const EXPOSE_REGEX =
  /EXPOS[ÉEeé]\s+DES\s+MOTIFS\s*([\s\S]*?)(?=TITRE\s+[IVX]|Article\s+(?:1er|premier|unique)|CHAPITRE|$)/i;

const MAX_FALLBACK_LENGTH = 5000;

/**
 * A whole batch answering 404 means the endpoint moved, not that the AN
 * published nothing: one missing document is routine, a run where every single
 * one is missing is a broken URL scheme. Reported as an error so a silent no-op
 * cannot pass for a successful sync, which is how the docparl breakage would
 * have looked had the host kept resolving.
 */
const ALL_MISSING_ALERT_THRESHOLD = 5;

export interface LegislationContentSyncResult {
  processed: number;
  downloaded: number;
  extracted: number;
  notFound: number;
  skipped: number;
  errors: string[];
}

export function buildDocumentUrl(documentId: string): string {
  return DOCUMENT_URL_TEMPLATE.replace("{id}", encodeURIComponent(documentId));
}

function createClient(): HTTPClient {
  return new HTTPClient({
    rateLimitMs: ASSEMBLEE_OPENDATA_RATE_LIMIT_MS,
    retries: 3,
    timeout: 60_000,
    sourceName: "opendata AN",
  });
}

/**
 * Download a document and return its text, or null when the AN has no such
 * document (404 — a dossier whose text was never published in open data).
 */
export async function downloadDocumentText(
  documentId: string,
  client: HTTPClient = createClient()
): Promise<string | null> {
  try {
    const { data } = await client.getText(buildDocumentUrl(documentId), {
      headers: { Accept: "text/html" },
    });
    return extractBlockText(data);
  } catch (err) {
    if (err instanceof HTTPError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function extractExposeDesMotifs(fullText: string): string | null {
  const match = fullText.match(EXPOSE_REGEX);

  if (match && match[1]) {
    const expose = match[1].trim();
    if (expose.length > 50) {
      return expose;
    }
  }

  const trimmed = fullText.trim();
  if (trimmed.length > 100) {
    return trimmed.slice(0, MAX_FALLBACK_LENGTH);
  }

  return null;
}

export interface LegislationContentSyncOptions {
  limit?: number;
  force?: boolean;
  /** Count the dossiers that would be processed without fetching or writing. */
  dryRun?: boolean;
  /** Called before each download, for CLI progress display. */
  onProgress?: (done: number, total: number, documentId: string) => void;
}

export async function syncLegislationContent(
  options?: LegislationContentSyncOptions
): Promise<LegislationContentSyncResult> {
  const { limit, force = false, dryRun = false, onProgress } = options ?? {};

  const stats: LegislationContentSyncResult = {
    processed: 0,
    downloaded: 0,
    extracted: 0,
    notFound: 0,
    skipped: 0,
    errors: [],
  };

  const whereClause: Record<string, unknown> = {
    documentExternalId: { not: null },
  };

  if (!force) {
    whereClause.exposeDesMotifs = null;
  }

  let dossiers = await db.legislativeDossier.findMany({
    where: whereClause,
    select: {
      id: true,
      externalId: true,
      documentExternalId: true,
      title: true,
    },
    orderBy: { filingDate: "desc" },
  });

  if (limit) {
    dossiers = dossiers.slice(0, limit);
  }

  const total = dossiers.length;
  console.log(`Found ${total} dossiers to process`);

  if (total === 0) {
    return stats;
  }

  const client = createClient();

  for (let i = 0; i < dossiers.length; i++) {
    const dossier = dossiers[i]!;
    const docId = dossier.documentExternalId!;

    onProgress?.(i + 1, total, docId);

    try {
      if (dryRun) {
        stats.downloaded++;
        stats.extracted++;
        stats.processed++;
        continue;
      }

      const fullText = await downloadDocumentText(docId, client);

      if (fullText === null) {
        stats.notFound++;
        stats.processed++;
        continue;
      }

      stats.downloaded++;

      const expose = extractExposeDesMotifs(fullText);

      if (expose) {
        await db.legislativeDossier.update({
          where: { id: dossier.id },
          data: {
            exposeDesMotifs: expose,
            exposeSource: EXPOSE_SOURCE,
          },
        });
        stats.extracted++;
      } else {
        stats.skipped++;
      }

      stats.processed++;
    } catch (err) {
      stats.errors.push(`${dossier.externalId}: ${describeError(err)}`);
      stats.processed++;

      // A host that no longer resolves fails identically on every remaining
      // dossier. Stop here so the run reports the dead source once instead of
      // one line per dossier, which is how the docparl removal surfaced.
      if (isUnresolvableHostError(err)) {
        stats.errors.push(
          `Aborting: ${DOCUMENT_HOST} does not resolve, ${total - stats.processed} dossiers left unprocessed`
        );
        break;
      }
    }
  }

  if (stats.downloaded === 0 && stats.notFound >= ALL_MISSING_ALERT_THRESHOLD) {
    stats.errors.push(
      `All ${stats.notFound} documents answered 404 on ${DOCUMENT_HOST}: the open data URL scheme has most likely changed`
    );
  }

  return stats;
}
