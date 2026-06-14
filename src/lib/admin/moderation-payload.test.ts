import { describe, it, expect } from "vitest";
import {
  buildApplyAiPayload,
  buildBulkPayload,
  summarizeModerationResult,
  formatAffairFormError,
  type AffairForAi,
} from "./moderation-payload";
import { moderateAffairSchema, bulkAffairSchema } from "@/lib/security/schemas/affair";

/**
 * Regression suite for issue #364: the admin moderation UI sent payloads the
 * API could not accept, lost the rejection reason, and ignored the publish
 * guard's structured failures. These tests round-trip the built payloads
 * through the real server schemas, so they fail if the contract drifts again.
 */
const AFFAIRS: AffairForAi[] = [
  { id: "affair-1", moderationReviews: [{ recommendation: "PUBLISH" }] },
  { id: "affair-2", moderationReviews: [{ recommendation: "REJECT" }] },
  {
    id: "affair-3",
    moderationReviews: [{ recommendation: "PUBLISH" }, { recommendation: "NEEDS_REVIEW" }],
  },
];

describe("buildApplyAiPayload (#364 — apply AI button)", () => {
  it("collects affair ids (not review ids) for the matching recommendation", () => {
    expect(buildApplyAiPayload(AFFAIRS, "PUBLISH").ids).toEqual(["affair-1", "affair-3"]);
    expect(buildApplyAiPayload(AFFAIRS, "REJECT").ids).toEqual(["affair-2"]);
  });

  it("maps the recommendation to the schema action", () => {
    expect(buildApplyAiPayload(AFFAIRS, "PUBLISH").action).toBe("publish");
    expect(buildApplyAiPayload(AFFAIRS, "REJECT").action).toBe("reject");
  });

  it("produces a payload the server schema accepts", () => {
    expect(moderateAffairSchema.safeParse(buildApplyAiPayload(AFFAIRS, "PUBLISH")).success).toBe(
      true
    );
  });

  it("documents the bug: the legacy {reviewIds, action:'apply'} payload is rejected", () => {
    expect(moderateAffairSchema.safeParse({ reviewIds: ["r1"], action: "apply" }).success).toBe(
      false
    );
  });
});

describe("buildBulkPayload (#364 — rejection reason preserved)", () => {
  it("carries the rejection reason under `value`, the field the route reads", () => {
    const parsed = bulkAffairSchema.parse(
      buildBulkPayload("reject", ["a1", "a2"], "Source absente")
    );
    expect(parsed.value).toBe("Source absente");
  });

  it("documents the bug: the legacy `rejectionReason` field is stripped to undefined", () => {
    const legacy = bulkAffairSchema.parse({ ids: ["a1"], action: "reject", rejectionReason: "x" });
    expect(legacy.value).toBeUndefined();
  });

  it("omits `value` when no reason is supplied", () => {
    const payload = buildBulkPayload("publish", ["a1"]);
    expect(payload.value).toBeUndefined();
    expect(bulkAffairSchema.safeParse(payload).success).toBe(true);
  });
});

describe("summarizeModerationResult (#364 — no false success)", () => {
  it("reports success when nothing failed", () => {
    const r = summarizeModerationResult({ updated: 3, failed: [] });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("3");
  });

  it("surfaces the publish-guard failures instead of a false success", () => {
    const r = summarizeModerationResult({
      updated: 0,
      failed: [{ id: "a1", reasons: ["aucune source vérifiable"] }],
    });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("aucune source vérifiable");
  });

  it("reports a partial success (some published, some blocked)", () => {
    const r = summarizeModerationResult({
      updated: 2,
      failed: [{ id: "a3", reasons: ["rattachement non validé"] }],
    });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("2");
    expect(r.message).toContain("rattachement non validé");
  });

  it("handles the delete response shape", () => {
    expect(summarizeModerationResult({ deleted: 5 }).ok).toBe(true);
  });
});

describe("formatAffairFormError (#364 — publish-guard reasons)", () => {
  it("surfaces the 422 publish-guard reasons", () => {
    const msg = formatAffairFormError({
      error: "Affaire non publiable",
      reasons: ["aucune source vérifiable", "rattachement non validé"],
      fieldsSaved: true,
    });
    expect(msg).toContain("aucune source vérifiable");
    expect(msg).toContain("rattachement non validé");
  });

  it("falls back to a plain string error", () => {
    expect(formatAffairFormError({ error: "Erreur serveur" })).toContain("Erreur serveur");
  });

  it("flattens a Zod object error", () => {
    const msg = formatAffairFormError({
      error: { formErrors: ["Erreur globale"], fieldErrors: { title: ["requis"] } },
    });
    expect(msg).toContain("Erreur globale");
    expect(msg).toContain("title");
  });
});
