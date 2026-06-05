/**
 * Plain (non-"use server") module for runtime values shared by the policy-title
 * admin actions. A "use server" module may export ONLY async functions, so the
 * ApproveBlockedError class cannot live in actions.ts — it would make Next
 * reject the whole actions module ("module has no exports at all").
 */
export class ApproveBlockedError extends Error {
  codes: string[];
  constructor(codes: string[]) {
    super(`Approbation bloquée : ${codes.join(", ")}`);
    this.name = "ApproveBlockedError";
    this.codes = codes;
  }
}
