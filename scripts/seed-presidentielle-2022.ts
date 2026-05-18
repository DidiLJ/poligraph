import "dotenv/config";
import { db } from "../src/lib/db";

interface Candidate2022 {
  politicianSlug: string;
  party: string;
  pctT1: number;
  pctT2: number | null;
}

// Source: resultats-elections.interieur.gouv.fr (présidentielle 2022).
const CANDIDATES_2022: Candidate2022[] = [
  { politicianSlug: "emmanuel-macron", party: "Renaissance", pctT1: 27.85, pctT2: 58.55 },
  { politicianSlug: "marine-le-pen", party: "RN", pctT1: 23.15, pctT2: 41.45 },
  { politicianSlug: "jean-luc-melenchon", party: "LFI", pctT1: 21.95, pctT2: null },
  { politicianSlug: "eric-zemmour", party: "Reconquête", pctT1: 7.07, pctT2: null },
  { politicianSlug: "valerie-pecresse", party: "LR", pctT1: 4.78, pctT2: null },
  { politicianSlug: "yannick-jadot", party: "EELV", pctT1: 4.63, pctT2: null },
  { politicianSlug: "jean-lassalle", party: "Résistons !", pctT1: 3.13, pctT2: null },
  { politicianSlug: "fabien-roussel", party: "PCF", pctT1: 2.28, pctT2: null },
  { politicianSlug: "nicolas-dupont-aignan", party: "DLF", pctT1: 2.06, pctT2: null },
  { politicianSlug: "anne-hidalgo", party: "PS", pctT1: 1.74, pctT2: null },
  { politicianSlug: "philippe-poutou", party: "NPA", pctT1: 0.77, pctT2: null },
  { politicianSlug: "nathalie-arthaud", party: "LO", pctT1: 0.56, pctT2: null },
];

async function main() {
  const existing = await db.election.findUnique({
    where: { slug: "presidentielle-2022" },
  });
  if (existing) {
    console.log("Election presidentielle-2022 déjà présente, on ne refait pas le seed.");
    return;
  }

  const election = await db.election.create({
    data: {
      slug: "presidentielle-2022",
      type: "PRESIDENTIELLE",
      title: "Élection présidentielle de 2022",
      shortTitle: "Présidentielle 2022",
      description:
        "Élection présidentielle française, 10 et 24 avril 2022. Réélection d'Emmanuel Macron face à Marine Le Pen au second tour.",
      round1Date: new Date("2022-04-10T00:00:00.000Z"),
      round2Date: new Date("2022-04-24T00:00:00.000Z"),
      dateConfirmed: true,
      scope: "NATIONAL",
      status: "COMPLETED",
      featured: false,
      sourceUrl: "https://www.resultats-elections.interieur.gouv.fr/presidentielle-2022/",
    },
  });

  await db.electionRound.create({
    data: {
      electionId: election.id,
      round: 1,
      date: new Date("2022-04-10T00:00:00.000Z"),
    },
  });
  await db.electionRound.create({
    data: {
      electionId: election.id,
      round: 2,
      date: new Date("2022-04-24T00:00:00.000Z"),
    },
  });

  let created = 0;
  let skipped = 0;

  for (const c of CANDIDATES_2022) {
    const politician = await db.politician.findUnique({
      where: { slug: c.politicianSlug },
      select: { id: true, fullName: true, currentPartyId: true },
    });

    if (!politician) {
      console.warn(`[warn] Politician slug '${c.politicianSlug}' introuvable, on saute.`);
      skipped++;
      continue;
    }

    await db.candidacy.create({
      data: {
        electionId: election.id,
        politicianId: politician.id,
        partyId: politician.currentPartyId ?? null,
        candidateName: politician.fullName,
        partyLabel: c.party,
        status: "DECLARE",
        round1Pct: c.pctT1,
        round2Pct: c.pctT2,
        isElected: c.politicianSlug === "emmanuel-macron",
      },
    });
    created++;
  }

  console.log(
    `Seeded présidentielle-2022: election + 2 rounds + ${created} candidacies (${skipped} skipped).`
  );

  await db.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erreur seed :", err);
    process.exit(1);
  });
