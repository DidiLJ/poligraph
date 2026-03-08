import type { WeeklyRecapData } from "@/lib/data/recap";

/**
 * Build a factual editorial summary from recap data (no AI).
 */
export function buildStaticEditorial(recap: WeeklyRecapData, weekNum: number): string {
  const parts: string[] = [];

  if (recap.votes.total > 0) {
    parts.push(
      `${recap.votes.total} scrutins ont été examinés en semaine ${weekNum}, dont ${recap.votes.adopted} adopté${recap.votes.adopted > 1 ? "s" : ""} et ${recap.votes.rejected} rejeté${recap.votes.rejected > 1 ? "s" : ""}.`
    );
  }

  if (recap.affairs.total > 0) {
    parts.push(
      `${recap.affairs.total} affaire${recap.affairs.total > 1 ? "s" : ""} judiciaire${recap.affairs.total > 1 ? "s" : ""} ${recap.affairs.total > 1 ? "ont" : "a"} été signalée${recap.affairs.total > 1 ? "s" : ""}.`
    );
  }

  if (recap.press.articleCount > 0) {
    parts.push(`${recap.press.articleCount} articles de presse ont couvert la vie politique.`);
  }

  if (parts.length === 0) {
    parts.push("Semaine calme sur la scène parlementaire.");
  }

  return parts.join(" ");
}

/**
 * Build a short politician bio line from structured data (no AI).
 */
export function buildStaticBio(
  fullName: string,
  mandateTitle: string | null | undefined,
  partyShortName: string | null | undefined
): string {
  const parts = [fullName];
  if (mandateTitle) parts.push(mandateTitle);
  if (partyShortName) parts.push(`membre du ${partyShortName}`);
  return parts.join(", ") + ".";
}
