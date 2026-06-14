/**
 * Client-side contract helpers for the admin affairs moderation UI (issue #364).
 *
 * The page used to send payloads the API could not accept, lost the rejection
 * reason, and ignored the publish guard's `failed[]` list. These pure helpers
 * build the exact shapes the server schemas expect and turn the responses into
 * user-facing messages, so the contract is covered by unit tests rather than
 * buried inside the component.
 */

export type AiRecommendation = "PUBLISH" | "REJECT";

export interface AffairForAi {
  id: string;
  moderationReviews: { recommendation: "PUBLISH" | "REJECT" | "NEEDS_REVIEW" }[];
}

/** Matches `moderateAffairSchema` (ids = affair ids, action enum). */
export interface ModeratePayload {
  ids: string[];
  action: "publish" | "exclude" | "reject" | "archive";
}

/** Matches `bulkAffairSchema` (action string, optional `value`). */
export interface BulkPayload {
  ids: string[];
  action: string;
  value?: string;
}

const RECOMMENDATION_TO_ACTION: Record<AiRecommendation, ModeratePayload["action"]> = {
  PUBLISH: "publish",
  REJECT: "reject",
};

/**
 * Build the `/moderate` payload that applies an AI recommendation. Collects the
 * AFFAIR ids (not the moderation-review ids) whose review matches the
 * recommendation, and maps the recommendation to the schema action.
 */
export function buildApplyAiPayload(
  affairs: AffairForAi[],
  recommendation: AiRecommendation
): ModeratePayload {
  const ids = affairs
    .filter((a) => a.moderationReviews.some((r) => r.recommendation === recommendation))
    .map((a) => a.id);
  return { ids, action: RECOMMENDATION_TO_ACTION[recommendation] };
}

/**
 * Build the `/bulk` payload. The rejection reason travels under `value`, the
 * field the route reads (`rejectionReason = typeof value === "string" ? ...`).
 */
export function buildBulkPayload(
  action: "publish" | "reject" | "delete",
  ids: string[],
  rejectionReason?: string
): BulkPayload {
  return {
    ids,
    action,
    ...(rejectionReason ? { value: rejectionReason } : {}),
  };
}

export interface ModerationResult {
  updated?: number;
  deleted?: number;
  failed?: { id: string; reasons: string[] }[];
}

/**
 * Turn a `/moderate` or `/bulk` response into a user-facing message. When the
 * publish guard blocked items, the message reports it instead of a false
 * success.
 */
export function summarizeModerationResult(result: ModerationResult): {
  ok: boolean;
  message: string;
} {
  const failed = result.failed ?? [];
  const processed = result.updated ?? result.deleted ?? 0;

  if (failed.length === 0) {
    return { ok: true, message: `${processed} affaire(s) traitée(s).` };
  }

  const reasons = [...new Set(failed.flatMap((f) => f.reasons))];
  const reasonSuffix = reasons.length > 0 ? ` : ${reasons.join(", ")}` : "";
  return {
    ok: false,
    message: `${processed} traitée(s), ${failed.length} bloquée(s) par le garde-fou de publication${reasonSuffix}.`,
  };
}

interface AffairFormErrorBody {
  error?: unknown;
  reasons?: unknown;
  fieldsSaved?: unknown;
}

/**
 * Format the error message for a failed affair save. Surfaces the publish
 * guard's actionable `reasons[]` (HTTP 422), flattens Zod object errors, and
 * falls back to a plain string error.
 */
export function formatAffairFormError(data: AffairFormErrorBody): string {
  if (Array.isArray(data.reasons) && data.reasons.length > 0) {
    const reasons = data.reasons.filter((r): r is string => typeof r === "string");
    const prefix = typeof data.error === "string" ? data.error : "Affaire non publiable";
    return `${prefix} : ${reasons.join(", ")}`;
  }

  if (data.error && typeof data.error === "object") {
    const flat = data.error as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };
    const messages: string[] = [...(flat.formErrors ?? [])];
    if (flat.fieldErrors) {
      for (const [field, errs] of Object.entries(flat.fieldErrors)) {
        if (Array.isArray(errs)) messages.push(`${field}: ${errs.join(", ")}`);
      }
    }
    return messages.join(" | ") || "Erreur de validation";
  }

  return typeof data.error === "string" ? data.error : "Erreur lors de la sauvegarde";
}
