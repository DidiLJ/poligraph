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
import type { Prisma, ScrutinPolicyTitle } from "@/generated/prisma";

/**
 * Thrown when a transition to APPROVED is blocked. Carries the machine-readable
 * blocker codes (hard blockers from the guard, or "WARNINGS_REQUIRE_OVERRIDE" /
 * "REJECTED_NOT_REVISED") so the UI can surface them via toast.
 */
export class ApproveBlockedError extends Error {
  codes: string[];
  constructor(codes: string[]) {
    super(`Approbation bloquée : ${codes.join(", ")}`);
    this.name = "ApproveBlockedError";
    this.codes = codes;
  }
}

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
