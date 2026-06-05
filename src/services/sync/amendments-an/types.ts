import type { AmendmentStatus, Chamber } from "@/generated/prisma";

export interface NormalizedAmendment {
  externalId: string; // uid
  number: string; // identification.numeroLong (string!)
  texteRef: string | null; // texteLegislatifRef
  dossierRefFromPath: string | null; // DLR… from the ZIP path (resolved to dossierId by the writer)
  article: string | null; // pointeurFragmentTexte.division.articleDesignation
  content: string | null; // corps.contenuAuteur.dispositif (raw HTML)
  summary: string | null; // corps.contenuAuteur.exposeSommaire (raw HTML)
  status: AmendmentStatus;
  parentExternalId: string | null; // amendementParentRef
  identicalDiscussionId: string | null; // discussionIdentique.idDiscussion
  authorType: string | null; // signataires.auteur.typeAuteur
  authorName: string | null; // signataires.libelle
  legislature: number;
  chamber: Chamber;
}

export interface SyncAmendmentsANOptions {
  legislature?: number; // default 17
  dryRun?: boolean; // parse + report, no DB writes
  limit?: number; // cap records processed (debug/sample)
  force?: boolean; // ignore etag, force re-download
  zipPath?: string; // use a local ZIP instead of downloading (debug/tests)
  batchSize?: number; // default 500
  verbose?: boolean;
}

export interface SyncWarning {
  code: string;
  message: string;
  externalId?: string;
}

export interface SyncAmendmentsANStats {
  notModified?: boolean; // true when feed-state returned 304 and the run short-circuited
  downloadedBytes?: number; // bytes written to disk this run (0 when notModified or zipPath used)
  amendmentsSeen: number;
  amendmentsCreated: number;
  amendmentsUpdated: number;
  amendmentsSkipped: number;
  parentLinksResolved: number;
  parentLinksDeferred: number;
  identicalGroupsResolved: number;
  dossiersResolved: number;
  dossiersUnresolved: number;
  warnings: SyncWarning[];
  durationMs: number;
}
