import type { Involvement } from "@/types";

/**
 * Involvements that require a sourced involvement note before publication.
 *
 * A non-accused person must have their presence justified (RGPD art. 10, I3/I5). For a
 * victim or a plaintiff the involvement type already carries that justification, so a note
 * is redundant. For a bare mention or an indirect link the role stays vague, and the note
 * is what states why the person appears at all.
 *
 * Shared by the publish guard and the admin form so both agree on the rule.
 */
const REQUIRES_NOTE: ReadonlySet<Involvement> = new Set<Involvement>([
  "MENTIONED_ONLY",
  "INDIRECT",
]);

export function involvementRequiresNote(involvement: Involvement): boolean {
  return REQUIRES_NOTE.has(involvement);
}
