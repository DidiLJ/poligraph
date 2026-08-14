import type { Chamber } from "@/generated/prisma";

/**
 * SEO strings for /parlement/groupes/[slug].
 *
 * The chamber is a stored property of the group, so it is always named. What
 * the description may promise is limited to what the page can actually show:
 * the seat count only when members are attached, and the cohesion only when a
 * stats row exists. Participation is deliberately absent — its publication
 * policy is being hardened in #717 and it must not become an SEO claim.
 */

export interface GroupeSeoInput {
  name: string;
  code: string;
  chamber: Chamber;
  /** Current members attached to the group; 0 means "none recorded", not "none". */
  seatCount: number;
  /** True when a computed stats row exists (cohesion is then displayed). */
  hasStats: boolean;
}

export interface GroupeSeo {
  title: string;
  description: string;
}

function chamberPreposition(chamber: Chamber): string {
  return chamber === "AN" ? "à l'Assemblée nationale" : "au Sénat";
}

export function buildGroupeSeo({
  name,
  code,
  chamber,
  seatCount,
  hasStats,
}: GroupeSeoInput): GroupeSeo {
  const preposition = chamberPreposition(chamber);

  // A group with no recorded member says nothing about its real size: leave the
  // count out rather than advertise "0 membres".
  const items: string[] = [];
  if (seatCount > 0) items.push(`${seatCount} membre${seatCount > 1 ? "s" : ""}`);
  items.push("votes parlementaires");
  if (hasStats) items.push("cohésion du groupe");

  return {
    title: `${name} ${preposition} : membres et votes`,
    description: `${name} (${code}) ${preposition} : ${items.join(", ")}.`,
  };
}
