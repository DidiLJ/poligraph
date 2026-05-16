import "dotenv/config";
import { db } from "../src/lib/db";
import type { CandidacyStatus } from "../src/generated/prisma";

interface CandidateInput {
  candidateName: string;
  politicianSlug?: string;
  status: CandidacyStatus;
  partyLabel: string;
  sourceUrl: string;
  sourceLabel: string;
}

// Editorial snapshot: présidentielle 2027 candidates identifiable as of 2026-05-16.
// Statuses: PRESSENTI (sources crédibles annoncent l'intention) vs ENVISAGE (hypothèse de presse).
// Source URLs use fr.wikipedia.org pages, the conservative editorial fallback when no fresh press article was verified.
const CANDIDATES: CandidateInput[] = [
  {
    candidateName: "Jean-Luc Mélenchon",
    politicianSlug: "jean-luc-melenchon",
    status: "PRESSENTI",
    partyLabel: "LFI",
    sourceUrl: "https://fr.wikipedia.org/wiki/Jean-Luc_M%C3%A9lenchon",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
  {
    candidateName: "Marine Le Pen",
    politicianSlug: "marine-le-pen",
    status: "PRESSENTI",
    partyLabel: "RN",
    sourceUrl: "https://fr.wikipedia.org/wiki/Marine_Le_Pen",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
  {
    candidateName: "Jordan Bardella",
    politicianSlug: "jordan-bardella",
    status: "PRESSENTI",
    partyLabel: "RN",
    sourceUrl: "https://fr.wikipedia.org/wiki/Jordan_Bardella",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
  {
    candidateName: "Raphaël Glucksmann",
    politicianSlug: "raphael-glucksmann",
    status: "PRESSENTI",
    partyLabel: "Place publique",
    sourceUrl: "https://fr.wikipedia.org/wiki/Rapha%C3%ABl_Glucksmann",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
  {
    candidateName: "François Ruffin",
    politicianSlug: "francois-ruffin",
    status: "ENVISAGE",
    partyLabel: "Picardie Debout",
    sourceUrl: "https://fr.wikipedia.org/wiki/Fran%C3%A7ois_Ruffin",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
  {
    candidateName: "Laurent Wauquiez",
    politicianSlug: "laurent-wauquiez",
    status: "PRESSENTI",
    partyLabel: "LR",
    sourceUrl: "https://fr.wikipedia.org/wiki/Laurent_Wauquiez",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
  {
    candidateName: "Olivier Faure",
    politicianSlug: "olivier-faure",
    status: "PRESSENTI",
    partyLabel: "PS",
    sourceUrl: "https://fr.wikipedia.org/wiki/Olivier_Faure_(homme_politique)",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
  {
    candidateName: "Fabien Roussel",
    politicianSlug: "fabien-roussel",
    status: "PRESSENTI",
    partyLabel: "PCF",
    sourceUrl: "https://fr.wikipedia.org/wiki/Fabien_Roussel",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
  {
    candidateName: "Marine Tondelier",
    politicianSlug: "marine-tondelier",
    status: "ENVISAGE",
    partyLabel: "EELV",
    sourceUrl: "https://fr.wikipedia.org/wiki/Marine_Tondelier",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
  {
    candidateName: "Gabriel Attal",
    politicianSlug: "gabriel-attal",
    status: "ENVISAGE",
    partyLabel: "Renaissance",
    sourceUrl: "https://fr.wikipedia.org/wiki/Gabriel_Attal",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
  {
    candidateName: "Édouard Philippe",
    politicianSlug: "edouard-philippe",
    status: "PRESSENTI",
    partyLabel: "Horizons",
    sourceUrl: "https://fr.wikipedia.org/wiki/%C3%89douard_Philippe",
    sourceLabel: "Wikipédia (consultée le 2026-05-16)",
  },
];

async function main() {
  const election = await db.election.findUnique({
    where: { slug: "presidentielle-2027" },
    select: { id: true },
  });
  if (!election) {
    throw new Error(
      "Election 'presidentielle-2027' not seeded. Run scripts/seed-elections.ts first."
    );
  }

  let linked = 0;
  let unlinked = 0;

  for (const c of CANDIDATES) {
    const politician = c.politicianSlug
      ? await db.politician.findUnique({
          where: { slug: c.politicianSlug },
          select: { id: true },
        })
      : null;

    if (c.politicianSlug && !politician) {
      console.warn(
        `[warn] Politician slug '${c.politicianSlug}' not found for '${c.candidateName}'; storing Candidacy without politician link.`
      );
    }

    if (politician) linked++;
    else unlinked++;

    const existing = await db.candidacy.findFirst({
      where: { electionId: election.id, candidateName: c.candidateName },
      select: { id: true },
    });

    if (existing) {
      await db.candidacy.update({
        where: { id: existing.id },
        data: {
          status: c.status,
          partyLabel: c.partyLabel,
          sourceUrl: c.sourceUrl,
          sourceLabel: c.sourceLabel,
          politicianId: politician?.id ?? null,
        },
      });
    } else {
      await db.candidacy.create({
        data: {
          electionId: election.id,
          candidateName: c.candidateName,
          status: c.status,
          partyLabel: c.partyLabel,
          sourceUrl: c.sourceUrl,
          sourceLabel: c.sourceLabel,
          politicianId: politician?.id ?? null,
        },
      });
    }
  }

  console.log(
    `Seeded présidentielle-2027: ${CANDIDATES.length} candidacies (${linked} linked to Politician, ${unlinked} unlinked).`
  );

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
