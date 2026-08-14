/**
 * Chamber-aware SEO strings for /politiques/[slug]/votes.
 *
 * The page used to assert "à l'Assemblée nationale" for everyone, which is
 * wrong for senators and unverifiable for anyone whose parliamentary mandate is
 * not established. Chamber is now resolved from the mandates and, when it stays
 * ambiguous, the copy simply says nothing about it (unknown != false).
 */

export type ParliamentaryChamber = "AN" | "SENAT";

/** Minimal mandate shape needed to resolve a chamber. */
export interface ChamberMandateSignal {
  type: string;
  isCurrent: boolean;
}

const CHAMBER_BY_MANDATE_TYPE: Readonly<Record<string, ParliamentaryChamber>> = {
  DEPUTE: "AN",
  SENATEUR: "SENAT",
};

function chambersOf(mandates: ReadonlyArray<ChamberMandateSignal>): Set<ParliamentaryChamber> {
  const chambers = new Set<ParliamentaryChamber>();
  for (const mandate of mandates) {
    const chamber = CHAMBER_BY_MANDATE_TYPE[mandate.type];
    if (chamber) chambers.add(chamber);
  }
  return chambers;
}

/**
 * The chamber a politician's votes belong to, or null when it cannot be
 * established without guessing.
 *
 * Current parliamentary mandates win. Holding a seat in both chambers at once
 * is legally impossible, so two current chambers means the data is wrong, not
 * that the person sits twice: the answer is null, never a pick. Without any
 * current parliamentary mandate, past ones are used only when they all point at
 * the same chamber — a former deputy who later became a senator stays null
 * rather than being attributed to whichever mandate looks most recent.
 */
export function resolveParliamentaryChamber(
  mandates: ReadonlyArray<ChamberMandateSignal>
): ParliamentaryChamber | null {
  const current = chambersOf(mandates.filter((m) => m.isCurrent));
  if (current.size === 1) return [...current][0] ?? null;
  if (current.size > 1) return null;

  const past = chambersOf(mandates);
  return past.size === 1 ? ([...past][0] ?? null) : null;
}

/** "à l'Assemblée nationale" / "au Sénat" — null when the chamber is unknown. */
export function chamberPreposition(chamber: ParliamentaryChamber | null): string | null {
  if (chamber === "AN") return "à l'Assemblée nationale";
  if (chamber === "SENAT") return "au Sénat";
  return null;
}

export interface PoliticianVotesSeo {
  title: string;
  description: string;
  /** Visible H1, enriched only when the chamber is established. */
  heading: string;
}

export function buildPoliticianVotesSeo(
  fullName: string,
  chamber: ParliamentaryChamber | null
): PoliticianVotesSeo {
  const preposition = chamberPreposition(chamber);

  if (!preposition) {
    return {
      title: `Votes parlementaires de ${fullName}`,
      description: `Consultez les votes parlementaires enregistrés pour ${fullName} : textes de loi, amendements et positions enregistrées.`,
      heading: `Votes de ${fullName}`,
    };
  }

  return {
    title: `Votes de ${fullName} ${preposition}`,
    description: `Consultez les votes parlementaires de ${fullName} ${preposition} : textes de loi, amendements et positions enregistrées.`,
    heading: `Votes de ${fullName} ${preposition}`,
  };
}

export interface PoliticianVotesIntroInput {
  fullName: string;
  chamber: ParliamentaryChamber | null;
  /** All recorded votes, every scrutin type included. */
  totalVotes: number;
  /** Subset cast on amendments. */
  amendmentVotes: number;
}

/**
 * Short visible intro, built from the tab counts the page already loads: no
 * extra query, no participation rate (issue #717), no reading of the voting
 * behaviour. Returns null when there is nothing recorded to describe.
 */
export function buildPoliticianVotesIntro({
  fullName,
  chamber,
  totalVotes,
  amendmentVotes,
}: PoliticianVotesIntroInput): string | null {
  if (totalVotes <= 0) return null;

  const preposition = chamberPreposition(chamber);
  const where = preposition ? ` ${preposition}` : "";
  const count = totalVotes.toLocaleString("fr-FR");

  const sentences: string[] = [
    totalVotes > 1
      ? `${count} votes de ${fullName} sont enregistrés${where}.`
      : `${count} vote de ${fullName} est enregistré${where}.`,
  ];

  if (amendmentVotes > 0) {
    sentences.push(
      amendmentVotes > 1
        ? `${amendmentVotes.toLocaleString("fr-FR")} portent sur des amendements.`
        : `${amendmentVotes.toLocaleString("fr-FR")} porte sur un amendement.`
    );
  }

  return sentences.join(" ");
}
