/**
 * Export vote data for Ma Boussole Politique.
 *
 * Queries the database for specific scrutin IDs and exports all
 * politician votes, party data, and majority positions.
 *
 * Usage:
 *   npx tsx scripts/export-boussole-data.ts
 *
 * Output: writes to ../boussole-politique/data/synced-data.json
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { writeFileSync } from "fs";
import { join } from "path";

const OUTPUT_PATH = join(__dirname, "../../boussole-politique/data/synced-data.json");

// Scrutin IDs from boussole-politique/data/scrutins.json
const SCRUTIN_IDS = [
  "cml2g74m4dv2eijv5yeaef1ml", // Nationalisation ArcelorMittal
  "cml2g8dvyfklaijv5awba9t1e", // Sécurité sociale 2026
  "cml2g8c2xfisfijv5cqcoyfbo", // Encadrement loyers
  "cml2g0v6c67mqijv5qwwpbmsh", // Contraintes agriculteurs
  "cml2g181g6jigijv55tbw369m", // Simplification urbanisme
  "cmm2fg4fw02ju1o214v348cht", // Aide à mourir
  "cml2g0vbq681tijv5fx2s0p9i", // Rétention condamnés
  "cml2g8dczfjxsijv5bim0dnc1", // Titres de séjour
  "cml2ga02uh0mmijv55qmm74po", // Mineurs réseaux sociaux
  "cml2g88waffqmijv57h01qto4", // Mineurs isolés/sans-abrisme
  "cml2g2j5v7vtjijv53jk3unha", // Origine denrées alimentaires
  "cmldazds3hcxtri3z737rs0e1", // Hydroélectricité
  "cml2g17wy6jdjijv5gw5pkgfe", // Accords emploi
  "cml2g6ji8d6vtijv5vmksglla", // Service postal
  "cml2ga7guh81kijv5ist7yyz2", // Parkings hôpitaux
  "cml2g8olafu9xijv5he1w3x8m", // Réparation homosexualité
  "cml2ga5udh70cijv5nnwofs2z", // Fin devoir conjugal
  "cml2g18su6kgyijv54xpm5pmc", // Définition viol
  "cml2g8oy3fuhnijv54sag7xra", // Réparation avortement
  "cml2g8dhdfk1oijv5g1yco48y", // Vie chère outre-mer
];

async function main() {
  console.log(`Exporting vote data for ${SCRUTIN_IDS.length} scrutins...`);

  // 1. Fetch all votes for these scrutins, with politician and party data
  const votes = await db.vote.findMany({
    where: {
      scrutinId: { in: SCRUTIN_IDS },
    },
    select: {
      scrutinId: true,
      politicianId: true,
      position: true,
      politician: {
        select: {
          id: true,
          fullName: true,
          slug: true,
          photoUrl: true,
          blobPhotoUrl: true,
          currentParty: {
            select: {
              id: true,
              name: true,
              shortName: true,
              color: true,
            },
          },
        },
      },
    },
  });

  console.log(`Found ${votes.length} votes`);

  // 2. Build vote matrix
  const voteMatrix: Record<string, Record<string, string>> = {};
  for (const id of SCRUTIN_IDS) {
    voteMatrix[id] = {};
  }
  for (const vote of votes) {
    voteMatrix[vote.scrutinId]![vote.politicianId] = vote.position;
  }

  // 3. Build unique politicians list
  const polMap = new Map<string, (typeof votes)[0]["politician"]>();
  for (const vote of votes) {
    if (!polMap.has(vote.politicianId)) {
      polMap.set(vote.politicianId, vote.politician);
    }
  }

  const politicians = [...polMap.values()].map((pol) => ({
    id: pol.id,
    fullName: pol.fullName,
    slug: pol.slug,
    photoUrl: pol.blobPhotoUrl || pol.photoUrl || null,
    partyShortName: pol.currentParty?.shortName || null,
    partyId: pol.currentParty?.id || null,
    mandateType: "DEPUTE",
  }));

  // 4. Build unique parties list
  const partyMap = new Map<
    string,
    { id: string; name: string; shortName: string; color: string | null }
  >();
  for (const pol of polMap.values()) {
    if (pol.currentParty && !partyMap.has(pol.currentParty.id)) {
      partyMap.set(pol.currentParty.id, {
        id: pol.currentParty.id,
        name: pol.currentParty.name,
        shortName: pol.currentParty.shortName,
        color: pol.currentParty.color,
      });
    }
  }
  const parties = [...partyMap.values()];

  // 5. Build party majority positions per scrutin
  const partyMajorities: Record<string, Record<string, string>> = {};
  for (const scrutinId of SCRUTIN_IDS) {
    partyMajorities[scrutinId] = {};
    const scrutinVotes = voteMatrix[scrutinId]!;

    for (const [partyId] of partyMap) {
      const partyPolIds = [...polMap.values()]
        .filter((p) => p.currentParty?.id === partyId)
        .map((p) => p.id);

      const counts: Record<string, number> = {};
      for (const polId of partyPolIds) {
        const position = scrutinVotes[polId];
        if (position && position !== "ABSENT" && position !== "NON_VOTANT") {
          counts[position] = (counts[position] || 0) + 1;
        }
      }

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        partyMajorities[scrutinId]![partyId] = sorted[0]![0];
      }
    }
  }

  // 6. Write output
  const syncedData = {
    voteMatrix,
    politicians,
    parties,
    partyMajorities,
    syncedAt: new Date().toISOString(),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(syncedData, null, 2), "utf-8");

  // Stats
  const totalVotes = votes.length;
  const activeVotes = votes.filter(
    (v) => v.position !== "ABSENT" && v.position !== "NON_VOTANT"
  ).length;
  console.log(`\nExport complete:`);
  console.log(`  ${politicians.length} politicians`);
  console.log(`  ${parties.length} parties`);
  console.log(`  ${totalVotes} total votes (${activeVotes} active)`);
  console.log(`  Written to ${OUTPUT_PATH}`);

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error("Export failed:", err);
  await db.$disconnect();
  process.exit(1);
});
