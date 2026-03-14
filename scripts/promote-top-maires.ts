import { db } from "@/lib/db";
import { promoteMaire } from "@/services/admin/promote-maire";
import { wikidataService, WIKIDATA_PROPS } from "@/lib/api/wikidata";
import {
  selectBestWikidataCandidate,
  type WikidataCandidate,
} from "@/services/admin/promote-maire";
import { DataSource } from "@/generated/prisma";

const MIN_POPULATION = parseInt(process.argv[2] || "50000", 10);
const DRY_RUN = !process.argv.includes("--apply");
const ENRICH = process.argv.includes("--enrich");

async function promote() {
  console.log(
    `Promotion des maires de communes > ${MIN_POPULATION.toLocaleString()} hab.` +
      (DRY_RUN ? " (DRY RUN)" : " (APPLY)")
  );

  const candidates = await db.localOfficial.findMany({
    where: {
      role: "MAIRE",
      isCurrent: true,
      politicianId: null,
      commune: { population: { gte: MIN_POPULATION } },
    },
    include: {
      commune: { select: { name: true, population: true, departmentCode: true } },
    },
    orderBy: { commune: { population: "desc" } },
  });

  console.log(`${candidates.length} maires eligibles\n`);

  if (DRY_RUN) {
    for (const c of candidates) {
      console.log(
        `  ${c.fullName.padEnd(30)} ${(c.commune?.name ?? "").padEnd(25)} ${String(c.commune?.population ?? 0).padStart(8)} hab.`
      );
    }
    console.log("\nAjouter --apply pour executer.");
    return;
  }

  let success = 0;
  let errors = 0;

  for (const c of candidates) {
    try {
      const result = await promoteMaire(c.id);
      console.log(
        `OK  ${c.fullName.padEnd(30)} -> ${result.slug} (Wikidata: ${result.wikidataId ?? "aucun"})`
      );
      success++;
    } catch (err) {
      console.error(
        `ERR ${c.fullName.padEnd(30)} ${err instanceof Error ? err.message : String(err)}`
      );
      errors++;
    }
  }

  console.log(`\nTermine: ${success} promus, ${errors} erreurs.`);
}

async function enrich() {
  console.log(
    `Enrichissement Wikidata des maires promus (communes > ${MIN_POPULATION.toLocaleString()} hab.)` +
      (DRY_RUN ? " (DRY RUN)" : " (APPLY)")
  );

  const officials = await db.localOfficial.findMany({
    where: {
      role: "MAIRE",
      isCurrent: true,
      politicianId: { not: null },
      commune: { population: { gte: MIN_POPULATION } },
    },
    include: {
      commune: { select: { name: true, population: true } },
      politician: {
        select: {
          id: true,
          fullName: true,
          photoUrl: true,
          externalIds: { where: { source: DataSource.WIKIDATA } },
        },
      },
    },
    orderBy: { commune: { population: "desc" } },
  });

  const missing = officials.filter((o) => o.politician && o.politician.externalIds.length === 0);

  console.log(`${missing.length} maires promus sans Wikidata ID\n`);

  let matched = 0;
  let skipped = 0;

  for (const o of missing) {
    const searchResults = await wikidataService.searchByName(o.fullName, {
      limit: 5,
    });

    if (searchResults.length === 0) {
      console.log(`SKIP ${o.fullName.padEnd(30)} aucun resultat Wikidata`);
      skipped++;
      continue;
    }

    const candidateIds = searchResults.map((r) => r.id);
    const [details, positions] = await Promise.all([
      wikidataService.checkFrenchPoliticians(candidateIds),
      wikidataService.getPositions(candidateIds),
    ]);

    const wdCandidates: WikidataCandidate[] = searchResults.map((r) => {
      const d = details.get(r.id);
      const pos = positions.get(r.id) ?? [];
      return {
        id: r.id,
        label: r.label ?? r.id,
        isFrench: d?.isFrench ?? false,
        isPolitician: d?.isPolitician ?? false,
        birthDate: d?.birthDate ?? null,
        hasMairePosition: pos.length > 0,
      };
    });

    const best = selectBestWikidataCandidate(wdCandidates, {
      birthDate: o.birthDate,
    });

    if (!best) {
      console.log(`SKIP ${o.fullName.padEnd(30)} aucun candidat valide`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`MATCH ${o.fullName.padEnd(30)} -> ${best.id} (${best.label})`);
      matched++;
      continue;
    }

    // Fetch enrichment data
    const lifeDates = await wikidataService.getLifeDates([best.id]);
    const wdBirthDate = lifeDates.get(best.id)?.birthDate ?? null;

    const entities = await wikidataService.getEntities([best.id]);
    const entity = entities.get(best.id);
    const imageClaim = entity?.claims?.[WIKIDATA_PROPS.IMAGE]?.[0];
    let wdPhotoUrl: string | null = null;
    if (imageClaim?.mainsnak?.datavalue?.value) {
      const filename = String(imageClaim.mainsnak.datavalue.value);
      const encoded = encodeURIComponent(filename.replace(/ /g, "_"));
      wdPhotoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=400`;
    }

    // Create ExternalId
    await db.externalId.create({
      data: {
        politicianId: o.politician!.id,
        source: DataSource.WIKIDATA,
        externalId: best.id,
        url: `https://www.wikidata.org/wiki/${best.id}`,
      },
    });

    // Update photo + birthDate if better
    const updates: Record<string, unknown> = {};
    if (wdPhotoUrl && !o.politician!.photoUrl) {
      updates.photoUrl = wdPhotoUrl;
      updates.photoSource = "wikidata";
    }
    if (wdBirthDate && !o.birthDate) {
      updates.birthDate = wdBirthDate;
    }
    if (Object.keys(updates).length > 0) {
      await db.politician.update({
        where: { id: o.politician!.id },
        data: updates,
      });
    }

    console.log(
      `OK  ${o.fullName.padEnd(30)} -> ${best.id} (photo: ${wdPhotoUrl ? "oui" : "non"})`
    );
    matched++;
  }

  console.log(
    `\nTermine: ${matched} enrichis, ${skipped} sans match.` +
      (DRY_RUN ? " Ajouter --apply pour ecrire en base." : "")
  );
}

async function main() {
  if (ENRICH) {
    await enrich();
  } else {
    await promote();
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
