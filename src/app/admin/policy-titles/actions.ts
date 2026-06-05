"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import {
  approveGuard,
  computeCurrentWarnings,
  detectEvidenceDrift,
  type HardBlocker,
} from "@/app/admin/policy-titles/approve-guard";
import { buildInputHashInput, generateScrutinPolicyTitle } from "@/services/scrutin-policy-title";
import { computeInputHash } from "@/services/scrutin-policy-title/input-hash";
import { resolveSubstanceSources } from "@/services/scrutin-policy-title/substance-resolver";
import type {
  EvidenceQuote,
  GenerationWarning,
  SubstanceTextBlock,
} from "@/services/scrutin-policy-title/types";
import { queryQueue, type QueueFilters } from "@/app/admin/policy-titles/_data/queue-query";
import { ApproveBlockedError } from "@/app/admin/policy-titles/errors";
import type { Prisma, ScrutinPolicyTitle } from "@/generated/prisma";

/**
 * The admin auth in this project is a single signed cookie with no per-user
 * identity (see src/lib/auth.ts). There is no session/user to read, so every
 * action attributes its revision and review fields to a constant actor.
 */
const ACTOR = "admin";

async function assertAuthenticated(): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Non autorisé");
}

interface ApprovalContext {
  row: ScrutinPolicyTitle;
  scrutin: {
    id: string;
    title: string;
    sourceUrl: string | null;
    amendmentLinks: { role: string; amendment: { id: string; number: string } }[];
  };
  blocks: SubstanceTextBlock[];
  currentInputHash: string;
  currentWarnings: GenerationWarning[];
  evidenceDrift: boolean;
}

/**
 * Loads the row + scrutin and recomputes substance, input hash, validator
 * warnings and evidence drift FRESH. Never trusts the stored values: every
 * approval decision must reflect what the official text says today. Shared by
 * the approve/edit actions so the guard always sees current reality.
 */
async function recomputeApprovalContext(scrutinId: string): Promise<ApprovalContext> {
  const policy = await db.scrutinPolicyTitle.findUnique({
    where: { scrutinId },
    include: {
      scrutin: {
        select: {
          id: true,
          title: true,
          sourceUrl: true,
          amendmentLinks: {
            select: { role: true, amendment: { select: { id: true, number: true } } },
          },
        },
      },
    },
  });

  if (!policy) throw new Error(`Aucun titre public pour le scrutin ${scrutinId}`);

  const { scrutin, ...row } = policy;

  const resolved = await resolveSubstanceSources(scrutinId);
  const currentInputHash = computeInputHash(
    buildInputHashInput(
      {
        title: scrutin.title,
        sourceUrl: scrutin.sourceUrl,
        amendmentLinks: scrutin.amendmentLinks.map((l) => ({
          role: l.role,
          amendment: { id: l.amendment.id, number: l.amendment.number },
        })),
      },
      row.proceduralLabel,
      resolved.blocks
    )
  );

  const evidenceQuotes = (row.evidenceQuotes ?? []) as unknown as EvidenceQuote[];
  const currentWarnings = computeCurrentWarnings(
    row.policyTitle,
    row.policySubtitle,
    evidenceQuotes,
    resolved.blocks
  );
  const evidenceDrift = detectEvidenceDrift(evidenceQuotes, resolved.blocks);

  return {
    row: policy as ScrutinPolicyTitle,
    scrutin,
    blocks: resolved.blocks,
    currentInputHash,
    currentWarnings,
    evidenceDrift,
  };
}

function revalidate(scrutinId: string): void {
  revalidatePath("/admin/policy-titles");
  revalidatePath(`/admin/policy-titles/${scrutinId}`);
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/** Snapshot of the row as stored, for revision history. */
function snapshot(row: ScrutinPolicyTitle): Prisma.InputJsonValue {
  return row as unknown as Prisma.InputJsonValue;
}

/**
 * Edits the public title/subtitle in place. Marks the row editedFromGenerated,
 * recomputes and persists currentWarnings, and writes an "edited" revision whose
 * snapshot carries the PREVIOUS title/subtitle. Never changes status.
 */
export async function editScrutinPolicyTitle(
  scrutinId: string,
  { policyTitle, policySubtitle }: { policyTitle: string | null; policySubtitle: string | null }
): Promise<void> {
  await assertAuthenticated();

  const ctx = await recomputeApprovalContext(scrutinId);
  const { row, blocks } = ctx;

  const evidenceQuotes = (row.evidenceQuotes ?? []) as unknown as EvidenceQuote[];
  const newWarnings = computeCurrentWarnings(policyTitle, policySubtitle, evidenceQuotes, blocks);

  await db.$transaction(async (tx) => {
    await tx.scrutinPolicyTitleRevision.create({
      data: {
        policyTitleId: row.id,
        snapshot: {
          ...(snapshot(row) as object),
          previousPolicyTitle: row.policyTitle,
          previousPolicySubtitle: row.policySubtitle,
        } as Prisma.InputJsonValue,
        action: "edited",
        actorId: ACTOR,
      },
    });
    await tx.scrutinPolicyTitle.update({
      where: { id: row.id },
      data: {
        policyTitle,
        policySubtitle,
        editedFromGenerated: true,
        currentWarnings: asJson(newWarnings),
      },
    });
  });

  revalidate(scrutinId);
}

/** True when the row is REJECTED and its most-recent revision is a rejection. */
async function isRejectedNotRevised(row: ScrutinPolicyTitle): Promise<boolean> {
  if (row.status !== "REJECTED") return false;
  const latest = await db.scrutinPolicyTitleRevision.findFirst({
    where: { policyTitleId: row.id },
    orderBy: { createdAt: "desc" },
  });
  return latest?.action === "rejected";
}

interface ApprovePersistArgs {
  ctx: ApprovalContext;
  approvalOverride?: { reason: string; actor: string };
}

/** Persists APPROVED + the freshly recomputed hash/warnings + an "approved"
 *  revision. Only ever called after approveGuard returns ok. */
async function persistApproval({ ctx, approvalOverride }: ApprovePersistArgs): Promise<void> {
  const { row, currentInputHash, currentWarnings } = ctx;
  const reviewedAt = new Date();

  await db.$transaction(async (tx) => {
    await tx.scrutinPolicyTitleRevision.create({
      data: {
        policyTitleId: row.id,
        snapshot: {
          ...(snapshot(row) as object),
          ...(approvalOverride ? { approvalOverride } : {}),
        } as Prisma.InputJsonValue,
        action: "approved",
        actorId: ACTOR,
      },
    });
    await tx.scrutinPolicyTitle.update({
      where: { id: row.id },
      data: {
        status: "APPROVED",
        reviewedAt,
        reviewedBy: ACTOR,
        inputHash: currentInputHash,
        currentWarnings: asJson(currentWarnings),
      },
    });
  });
}

/**
 * Approves a clean row. Order: REJECTED-not-revised check, then approveGuard in
 * single mode. On INPUT_DRIFT the row is flipped to STALE (with a revision) before
 * throwing. Hard blockers and warnings both throw ApproveBlockedError.
 */
export async function approveScrutinPolicyTitle(scrutinId: string): Promise<void> {
  await assertAuthenticated();

  const ctx = await recomputeApprovalContext(scrutinId);
  const { row, currentInputHash, currentWarnings, evidenceDrift } = ctx;

  if (await isRejectedNotRevised(row)) {
    throw new ApproveBlockedError(["REJECTED_NOT_REVISED"]);
  }

  const result = approveGuard({
    row,
    currentInputHash,
    currentWarnings,
    evidenceDrift,
    mode: "single",
  });

  if (!result.ok) {
    await handleGuardFailure(row, scrutinId, result.hardBlockers);
  }

  await persistApproval({ ctx });
  revalidate(scrutinId);
}

/**
 * Approves a row with a reviewer override reason, clearing overridable warnings.
 * Hard blockers still throw. The "approved" revision snapshot records the override.
 */
export async function approveWithOverrideScrutinPolicyTitle(
  scrutinId: string,
  reason: string
): Promise<void> {
  await assertAuthenticated();

  const trimmed = reason?.trim();
  if (!trimmed) throw new Error("Un motif est requis pour forcer l'approbation");

  const ctx = await recomputeApprovalContext(scrutinId);
  const { row, currentInputHash, currentWarnings, evidenceDrift } = ctx;

  if (await isRejectedNotRevised(row)) {
    throw new ApproveBlockedError(["REJECTED_NOT_REVISED"]);
  }

  const result = approveGuard({
    row,
    currentInputHash,
    currentWarnings,
    evidenceDrift,
    mode: "single",
    override: { reason: trimmed, actor: ACTOR },
  });

  if (!result.ok) {
    await handleGuardFailure(row, scrutinId, result.hardBlockers);
  }

  await persistApproval({ ctx, approvalOverride: { reason: trimmed, actor: ACTOR } });
  revalidate(scrutinId);
}

/**
 * Shared failure path for the two approve actions. On INPUT_DRIFT, the row is no
 * longer trustworthy, so flip it to STALE (with a revision) before throwing. Then
 * throw ApproveBlockedError with the hard blockers, or WARNINGS_REQUIRE_OVERRIDE
 * when only overridable warnings remain. Always throws.
 */
async function handleGuardFailure(
  row: ScrutinPolicyTitle,
  scrutinId: string,
  hardBlockers: HardBlocker[]
): Promise<never> {
  if (hardBlockers.includes("INPUT_DRIFT")) {
    await db.$transaction(async (tx) => {
      await tx.scrutinPolicyTitleRevision.create({
        data: {
          policyTitleId: row.id,
          snapshot: snapshot(row),
          action: "marked_stale",
          actorId: ACTOR,
        },
      });
      await tx.scrutinPolicyTitle.update({
        where: { id: row.id },
        data: { status: "STALE" },
      });
    });
    revalidate(scrutinId);
  }

  throw new ApproveBlockedError(hardBlockers.length ? hardBlockers : ["WARNINGS_REQUIRE_OVERRIDE"]);
}

/**
 * Rejects a row. A HIGH-confidence row requires a non-empty reason. Writes a
 * "rejected" revision carrying the reason in its snapshot. Never APPROVED.
 */
export async function rejectScrutinPolicyTitle(scrutinId: string, reason: string): Promise<void> {
  await assertAuthenticated();

  const row = await db.scrutinPolicyTitle.findUnique({ where: { scrutinId } });
  if (!row) throw new Error(`Aucun titre public pour le scrutin ${scrutinId}`);

  const trimmed = reason?.trim() ?? "";
  if (row.confidence === "HIGH" && !trimmed) {
    throw new Error("Un motif est requis pour rejeter un titre de confiance élevée");
  }

  await db.$transaction(async (tx) => {
    await tx.scrutinPolicyTitleRevision.create({
      data: {
        policyTitleId: row.id,
        snapshot: { ...(snapshot(row) as object), reason: trimmed } as Prisma.InputJsonValue,
        action: "rejected",
        actorId: ACTOR,
      },
    });
    await tx.scrutinPolicyTitle.update({
      where: { id: row.id },
      data: { status: "REJECTED" },
    });
  });

  revalidate(scrutinId);
}

/**
 * Regenerates the title via the generator (which has its own APPROVED guard and
 * writes its own "regenerated" revision + overwrites the row). Sets a "running"
 * marker + a "regenerate_requested" revision first, then resets to idle on
 * success or "failed" with the error on throw. Never results in APPROVED.
 */
export async function regenerateScrutinPolicyTitle(scrutinId: string): Promise<void> {
  await assertAuthenticated();

  const row = await db.scrutinPolicyTitle.findUnique({ where: { scrutinId } });
  if (!row) throw new Error(`Aucun titre public pour le scrutin ${scrutinId}`);

  await db.$transaction(async (tx) => {
    await tx.scrutinPolicyTitleRevision.create({
      data: {
        policyTitleId: row.id,
        snapshot: snapshot(row),
        action: "regenerate_requested",
        actorId: ACTOR,
      },
    });
    await tx.scrutinPolicyTitle.update({
      where: { id: row.id },
      data: { regenerationStatus: "running", regenerationError: null },
    });
  });

  try {
    await generateScrutinPolicyTitle(scrutinId, {
      force: true,
      modelVersionDate: new Date().toISOString().slice(0, 10),
    });
    await db.scrutinPolicyTitle.update({
      where: { scrutinId },
      data: { regenerationStatus: "idle", regenerationError: null },
    });
  } catch (err) {
    await db.scrutinPolicyTitle.update({
      where: { scrutinId },
      data: { regenerationStatus: "failed", regenerationError: String(err) },
    });
  }

  revalidate(scrutinId);
}

// ──────────────────────────────────────────────────────────────────────────
// BATCH ACTIONS (Plan 5.8) — safety-first. batchApprove is all-or-nothing and
// extra conservative; batchRegenerate is capped; CSV exports are lean by default.
// ──────────────────────────────────────────────────────────────────────────

export interface BatchApproveFailure {
  scrutinId: string;
  reasons: string[];
}

export interface BatchApproveResult {
  approved: number;
  failures: BatchApproveFailure[];
}

/**
 * Per-id batch eligibility. Recomputes the approval context FRESH and runs the
 * guard in batch mode (which enforces HIGH confidence, zero currentWarnings, no
 * input/evidence drift, non-empty/<=140 title, no validation blocker). On top of
 * the guard, two explicit extra checks that batch mode must never relax:
 *   - zero generationWarnings (a row that generated with ANY warning is not clean)
 *   - the row is NOT a FALLBACK row
 * Returns the failure reasons for a row, or an empty array when batch-eligible.
 */
async function evaluateBatchEligibility(scrutinId: string): Promise<string[]> {
  const ctx = await recomputeApprovalContext(scrutinId);
  const { row, currentInputHash, currentWarnings, evidenceDrift } = ctx;
  const reasons: string[] = [];

  // REJECTED-not-revised is a hard precondition for the single path too.
  if (await isRejectedNotRevised(row)) {
    reasons.push("REJECTED_NOT_REVISED");
  }

  // Extra explicit checks (not all covered by the guard in batch mode).
  const generationWarnings = (row.generationWarnings ?? []) as unknown as GenerationWarning[];
  if (generationWarnings.length > 0) {
    reasons.push("GENERATION_WARNINGS");
  }
  if (row.generationSource === "FALLBACK") {
    reasons.push("FALLBACK_ROW");
  }

  const result = approveGuard({
    row,
    currentInputHash,
    currentWarnings,
    evidenceDrift,
    mode: "batch",
  });
  if (!result.ok) {
    for (const code of result.hardBlockers) reasons.push(code);
    // In batch mode the guard reports overridable warnings (incl. HIGH-confidence
    // failure) by leaving hardBlockers empty; surface that explicitly.
    if (result.hardBlockers.length === 0) reasons.push("NOT_BATCH_CLEAN");
  }

  return reasons;
}

/**
 * Approves a set of rows, EXTRA conservative and ALL-OR-NOTHING. Every id is
 * recomputed and evaluated against the batch guard plus the explicit extra
 * checks (zero generationWarnings, not FALLBACK). If ANY id fails, NONE are
 * approved and the failures are returned. Only when EVERY id passes are they all
 * approved via the same persistApproval path as the single approve action. There
 * is no override path in batch mode.
 */
export async function batchApprove(scrutinIds: string[]): Promise<BatchApproveResult> {
  await assertAuthenticated();

  const ids = Array.from(new Set(scrutinIds)).filter((id) => id.length > 0);
  if (ids.length === 0) return { approved: 0, failures: [] };

  const failures: BatchApproveFailure[] = [];
  const contexts: ApprovalContext[] = [];

  for (const scrutinId of ids) {
    const reasons = await evaluateBatchEligibility(scrutinId);
    if (reasons.length > 0) {
      failures.push({ scrutinId, reasons });
    } else {
      contexts.push(await recomputeApprovalContext(scrutinId));
    }
  }

  // ALL-OR-NOTHING: if any id failed, approve none.
  if (failures.length > 0) {
    return { approved: 0, failures };
  }

  for (const ctx of contexts) {
    await persistApproval({ ctx });
    revalidate(ctx.scrutin.id);
  }

  return { approved: contexts.length, failures: [] };
}

export interface BatchRegenerateResult {
  queued: number;
  ran: number;
  note?: string;
}

/** Beyond this count, batch regenerate queues rather than running inline. */
const BATCH_REGEN_INLINE_CAP = 10;

/**
 * Regenerates a set of rows. Above BATCH_REGEN_INLINE_CAP we never fire the
 * generator inline (that would mean hundreds of Mistral calls in one request):
 * each row is marked regenerationStatus "queued" and the caller is told to run
 * the offline script. At or below the cap, each row goes through the existing
 * single regenerate path inline. Never writes APPROVED.
 */
export async function batchRegenerate(scrutinIds: string[]): Promise<BatchRegenerateResult> {
  await assertAuthenticated();

  const ids = Array.from(new Set(scrutinIds)).filter((id) => id.length > 0);
  if (ids.length === 0) return { queued: 0, ran: 0 };

  if (ids.length > BATCH_REGEN_INLINE_CAP) {
    await db.scrutinPolicyTitle.updateMany({
      where: { scrutinId: { in: ids } },
      data: { regenerationStatus: "queued", regenerationError: null },
    });
    for (const id of ids) revalidate(id);
    return {
      queued: ids.length,
      ran: 0,
      note: "exceeds inline cap; run via script generateScrutinPolicyTitles({force})",
    };
  }

  for (const id of ids) {
    await regenerateScrutinPolicyTitle(id);
  }
  return { queued: 0, ran: ids.length };
}

// ── CSV export ─────────────────────────────────────────────────────────────

/** RFC-4180 field escaping: wrap in quotes and double internal quotes when the
 *  value contains a comma, quote or newline. */
function csvField(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const CSV_LEAN_HEADER = [
  "scrutinId",
  "votingDate",
  "proceduralLabel",
  "officialTitleSnapshot",
  "policyTitle",
  "policySubtitle",
  "status",
  "confidence",
  "warningCodes",
  "substanceDepth",
  "evidenceCoverage",
] as const;

interface CsvExportRow {
  scrutinId: string;
  votingDate: Date;
  proceduralLabel: string;
  officialTitleSnapshot: string;
  policyTitle: string | null;
  policySubtitle: string | null;
  status: string;
  confidence: string;
  currentWarnings: GenerationWarning[];
  qualitySignals: { substanceDepth?: string | null; evidenceCoverage?: number | null } | null;
  evidenceQuotes: EvidenceQuote[];
}

/** Loads the LEAN export columns for the filtered set. Uses queryQueue to honor
 *  the exact filters, then fetches only the extra fields the queue row lacks
 *  (policySubtitle, currentWarnings codes, evidenceCoverage). Never selects the
 *  heavy blobs (sources, inputs, amendment text). */
async function loadExportRows(filters: QueueFilters): Promise<CsvExportRow[]> {
  // Export is not paginated: pull the full filtered set.
  const { rows } = await queryQueue({ ...filters, take: 100_000, skip: 0 });
  if (rows.length === 0) return [];

  const scrutinIds = rows.map((r) => r.scrutinId);
  const details = await db.scrutinPolicyTitle.findMany({
    where: { scrutinId: { in: scrutinIds } },
    select: {
      scrutinId: true,
      policySubtitle: true,
      currentWarnings: true,
      qualitySignals: true,
      evidenceQuotes: true,
    },
  });
  const byId = new Map(details.map((d) => [d.scrutinId, d]));

  return rows.map((r) => {
    const d = byId.get(r.scrutinId);
    const qs = (d?.qualitySignals ?? null) as CsvExportRow["qualitySignals"];
    return {
      scrutinId: r.scrutinId,
      votingDate: r.votingDate,
      proceduralLabel: r.proceduralLabel,
      officialTitleSnapshot: r.officialTitleSnapshot,
      policyTitle: r.policyTitle,
      policySubtitle: (d?.policySubtitle ?? null) as string | null,
      status: r.status,
      confidence: r.confidence,
      currentWarnings: (d?.currentWarnings ?? []) as unknown as GenerationWarning[],
      qualitySignals: qs,
      evidenceQuotes: (d?.evidenceQuotes ?? []) as unknown as EvidenceQuote[],
    };
  });
}

function leanCells(r: CsvExportRow): string[] {
  return [
    csvField(r.scrutinId),
    csvField(r.votingDate.toISOString().slice(0, 10)),
    csvField(r.proceduralLabel),
    csvField(r.officialTitleSnapshot),
    csvField(r.policyTitle),
    csvField(r.policySubtitle),
    csvField(r.status),
    csvField(r.confidence),
    csvField(r.currentWarnings.map((w) => w.code).join("|")),
    csvField(r.qualitySignals?.substanceDepth ?? ""),
    csvField(r.qualitySignals?.evidenceCoverage ?? ""),
  ];
}

/**
 * LEAN CSV of the filtered queue. Columns are limited to display/triage fields;
 * NEVER includes evidenceQuotes, source/amendment text, or the inputs/sources
 * blobs. `warningCodes` joins the currentWarnings codes. Returns a CSV string.
 */
export async function exportPolicyTitlesCsv(filters: QueueFilters = {}): Promise<string> {
  await assertAuthenticated();
  const rows = await loadExportRows(filters);
  const lines = [CSV_LEAN_HEADER.join(","), ...rows.map((r) => leanCells(r).join(","))];
  return lines.join("\n");
}

/**
 * FULL CSV: the lean columns plus a JSON-stringified evidenceQuotes column. This
 * can be large, so it requires an explicit `confirmed: true`. Still excludes the
 * raw source/amendment text and the inputs/sources blobs.
 */
export async function exportPolicyTitlesCsvFull(
  filters: QueueFilters = {},
  { confirmed }: { confirmed: boolean }
): Promise<string> {
  await assertAuthenticated();
  if (!confirmed) {
    throw new Error("Export complet non confirmé : passez { confirmed: true } pour l'autoriser");
  }
  const rows = await loadExportRows(filters);
  const header = [...CSV_LEAN_HEADER, "evidenceQuotes"].join(",");
  const lines = [
    header,
    ...rows.map((r) => [...leanCells(r), csvField(JSON.stringify(r.evidenceQuotes))].join(",")),
  ];
  return lines.join("\n");
}
