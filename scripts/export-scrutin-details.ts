/**
 * Export scrutin details for the boussole-politique audit.
 *
 * Queries the database for each scrutin used in the quiz and exports
 * title, summary, citizenImpact, result, vote counts, and voting date.
 *
 * Usage: npx tsx scripts/export-scrutin-details.ts
 * Output: ../boussole-politique/data/scrutin-details.json
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { writeFileSync } from "fs";
import { join } from "path";

const OUTPUT_PATH = join(__dirname, "../../boussole-politique/data/scrutin-details.json");

const SCRUTIN_IDS = [
  "cml2g74m4dv2eijv5yeaef1ml",
  "cml2g8dvyfklaijv5awba9t1e",
  "cml2g8c2xfisfijv5cqcoyfbo",
  "cml2g0v6c67mqijv5qwwpbmsh",
  "cml2g181g6jigijv55tbw369m",
  "cmm2fg4fw02ju1o214v348cht",
  "cml2g0vbq681tijv5fx2s0p9i",
  "cml2g8dczfjxsijv5bim0dnc1",
  "cml2ga02uh0mmijv55qmm74po",
  "cml2g88waffqmijv57h01qto4",
  "cml2g2j5v7vtjijv53jk3unha",
  "cmldazds3hcxtri3z737rs0e1",
  "cml2g17wy6jdjijv5gw5pkgfe",
  "cml2g6ji8d6vtijv5vmksglla",
  "cml2ga7guh81kijv5ist7yyz2",
  "cml2g8olafu9xijv5he1w3x8m",
  "cml2ga5udh70cijv5nnwofs2z",
  "cml2g18su6kgyijv54xpm5pmc",
  "cml2g8oy3fuhnijv54sag7xra",
  "cml2g8dhdfk1oijv5g1yco48y",
];

async function main() {
  console.log("Fetching scrutin details from database...");

  const scrutins = await db.scrutin.findMany({
    where: { id: { in: SCRUTIN_IDS } },
    select: {
      id: true,
      title: true,
      summary: true,
      citizenImpact: true,
      result: true,
      votesFor: true,
      votesAgainst: true,
      votesAbstain: true,
      votingDate: true,
      chamber: true,
      sourceUrl: true,
    },
  });

  console.log(`Found ${scrutins.length}/${SCRUTIN_IDS.length} scrutins`);

  // Index by ID for easy lookup
  const indexed: Record<string, (typeof scrutins)[0]> = {};
  for (const s of scrutins) {
    indexed[s.id] = s;
    console.log(`  ${s.id}: ${s.title.substring(0, 80)}`);
  }

  const missing = SCRUTIN_IDS.filter((id) => !indexed[id]);
  if (missing.length > 0) {
    console.log(`\n⚠ Missing scrutins: ${missing.join(", ")}`);
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(indexed, null, 2) + "\n");
  console.log(`\nExported to ${OUTPUT_PATH}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
