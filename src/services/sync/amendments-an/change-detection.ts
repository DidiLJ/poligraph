import type { AmendmentStatus, Chamber } from "@/generated/prisma";

/**
 * The amendment fields the writer compares between the stored row and the
 * incoming parse to decide what (if anything) to write. Kept db-free so the
 * change-detection logic is unit-testable without a live database.
 */
export interface AmendmentComparable {
  number: string;
  texteRef: string | null;
  article: string | null;
  content: string | null;
  summary: string | null;
  status: AmendmentStatus;
  authorType: string | null;
  authorName: string | null;
  legislature: number;
  chamber: Chamber;
  dossierId: string | null;
}

export interface AmendmentDiff {
  /** True when `content` (dispositif) really changed (NFC + whitespace-insensitive). */
  contentChanged: boolean;
  /** True when `summary` (exposé sommaire) really changed. */
  summaryChanged: boolean;
  /** True when either substance field changed: content OR summary. */
  substanceChanged: boolean;
  /** True when any non-substance field really changed. */
  metadataChanged: boolean;
  /** The minimal Prisma update payload: only the fields that actually changed. */
  data: Partial<AmendmentComparable>;
}

/**
 * NFC + whitespace-collapse normalization used to decide whether a text field
 * "really changed". Treats precomposed vs. decomposed accents and whitespace-only
 * differences as equal, so a re-import that merely re-encodes identical text is
 * NOT counted as a change. This both removes write churn and avoids spurious
 * evidence drift on policy titles pinned to the earlier encoding.
 */
export function normalizeForChange(value: string | null): string | null {
  if (value == null) return null;
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** True when two text values differ after NFC + whitespace normalization. */
export function textReallyChanged(a: string | null, b: string | null): boolean {
  return normalizeForChange(a) !== normalizeForChange(b);
}

/**
 * Per-field change detection between the stored amendment and the incoming one.
 *
 * Substance is `content` (dispositif) AND `summary` (exposé sommaire): both feed
 * the policy-title evidence quotes, so either one changing is a substance change.
 * All long text fields are compared with NFC + whitespace normalization so
 * encoding-only re-imports are not flagged. `dossierId` is only treated as
 * changed when the incoming run actually resolved a dossier: a run that fails to
 * resolve the ref must never null out an existing link.
 *
 * Returns the minimal update payload plus the flags the writer uses to classify
 * the row. `substanceChanged` drives the regeneration signal consumed by a later
 * stage; `metadataChanged` distinguishes a metadata-only touch from a no-op.
 */
export function diffAmendmentRow(
  existing: AmendmentComparable,
  incoming: AmendmentComparable
): AmendmentDiff {
  const data: Partial<AmendmentComparable> = {};

  const contentChanged = textReallyChanged(existing.content, incoming.content);
  if (contentChanged) data.content = incoming.content;

  const summaryChanged = textReallyChanged(existing.summary, incoming.summary);
  if (summaryChanged) data.summary = incoming.summary;

  let metadataChanged = false;
  if (textReallyChanged(existing.article, incoming.article)) {
    data.article = incoming.article;
    metadataChanged = true;
  }
  if (textReallyChanged(existing.texteRef, incoming.texteRef)) {
    data.texteRef = incoming.texteRef;
    metadataChanged = true;
  }
  if (textReallyChanged(existing.number, incoming.number)) {
    data.number = incoming.number;
    metadataChanged = true;
  }
  if (textReallyChanged(existing.authorName, incoming.authorName)) {
    data.authorName = incoming.authorName;
    metadataChanged = true;
  }
  if (existing.authorType !== incoming.authorType) {
    data.authorType = incoming.authorType;
    metadataChanged = true;
  }
  if (existing.status !== incoming.status) {
    data.status = incoming.status;
    metadataChanged = true;
  }
  if (existing.legislature !== incoming.legislature) {
    data.legislature = incoming.legislature;
    metadataChanged = true;
  }
  if (existing.chamber !== incoming.chamber) {
    data.chamber = incoming.chamber;
    metadataChanged = true;
  }
  // Only adopt a resolved dossier; never null an existing link from a run that
  // failed to resolve the ref this time.
  if (incoming.dossierId !== null && incoming.dossierId !== existing.dossierId) {
    data.dossierId = incoming.dossierId;
    metadataChanged = true;
  }

  const substanceChanged = contentChanged || summaryChanged;
  return { contentChanged, summaryChanged, substanceChanged, metadataChanged, data };
}
