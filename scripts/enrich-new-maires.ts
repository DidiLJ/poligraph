import "dotenv/config";
import { db } from "../src/lib/db.js";
import { wikidataService, WIKIDATA_PROPS } from "../src/lib/api/wikidata.js";
import { selectBestWikidataCandidate } from "../src/services/admin/promote-maire.js";
import { setCurrentParty } from "../src/services/politician.js";
import { parse } from "csv-parse/sync";
import { DataSource, DeclarationType } from "../src/generated/prisma/index.js";
import { sleep } from "../src/lib/utils.js";

// Verified QID -> party slug mapping
const WD_PARTY_TO_SLUG: Record<string, string> = {
  Q205150: "rassemblement-national",
  Q27978402: "la-france-insoumise",
  Q23731823: "renaissance",
  Q20012759: "les-republicains",
  Q170972: "socialistes-et-apparentes",
  Q613786: "les-ecologistes-europe-ecologie-les-verts",
  Q192821: "parti-communiste-francais",
  Q587370: "mouvement-democrate",
  Q109932430: "reconquete",
  Q108846587: "horizons",
  Q82892: "union-des-democrates-et-independants",
  Q173152: "les-republicains", // UMP
  Q107877569: "rassemblement-national", // FN
  Q1052584: "les-republicains", // RPR
};

interface EnrichStats {
  wikidataFound: number;
  wikidataPhotos: number;
  wikidataParties: number;
  hatvpCreated: number;
  hatvpDeclarations: number;
  errors: number;
}

async function enrichWikidata(
  stats: EnrichStats,
  options: { limit?: number; dryRun?: boolean }
): Promise<void> {
  const { limit, dryRun = false } = options;

  const mayors = await db.politician.findMany({
    where: {
      publicationStatus: "DRAFT",
      mandates: { some: { type: "MAIRE", isCurrent: true } },
      externalIds: { none: { source: "WIKIDATA" } },
    },
    select: {
      id: true,
      fullName: true,
      birthDate: true,
      currentPartyId: true,
      localOffices: {
        where: { role: "MAIRE", isCurrent: true },
        select: { commune: { select: { population: true } } },
        take: 1,
      },
    },
    orderBy: { fullName: "asc" },
  });

  // Sort by commune population desc (largest communes first for better coverage)
  const sorted = mayors
    .map((m) => ({ ...m, population: m.localOffices[0]?.commune?.population ?? 0 }))
    .sort((a, b) => b.population - a.population);

  const toProcess = limit ? sorted.slice(0, limit) : sorted;
  console.log(`[Wikidata] ${toProcess.length} DRAFT maires to check (${sorted.length} total)`);

  if (dryRun) return;

  // Pre-load party slugs -> IDs
  const partyMap = new Map<string, string>();
  const parties = await db.party.findMany({ select: { id: true, slug: true } });
  for (const p of parties) {
    if (p.slug) partyMap.set(p.slug, p.id);
  }

  for (let i = 0; i < toProcess.length; i++) {
    const mayor = toProcess[i]!;
    try {
      const searchResults = await wikidataService.searchByName(mayor.fullName, { limit: 5 });
      await sleep(200);

      if (searchResults.length === 0) continue;

      const candidateIds = searchResults.map((r) => r.id);
      const [details, positions] = await Promise.all([
        wikidataService.checkFrenchPoliticians(candidateIds),
        wikidataService.getPositions(candidateIds),
      ]);

      const candidates = searchResults.map((r) => {
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

      const best = selectBestWikidataCandidate(candidates, { birthDate: mayor.birthDate });
      if (!best) continue;

      stats.wikidataFound++;

      await db.externalId.createMany({
        data: [
          {
            politicianId: mayor.id,
            source: DataSource.WIKIDATA,
            externalId: best.id,
            url: `https://www.wikidata.org/wiki/${best.id}`,
          },
        ],
        skipDuplicates: true,
      });

      // Photo via P18
      const entities = await wikidataService.getEntities([best.id]);
      const entity = entities.get(best.id);
      const imageClaim = entity?.claims?.[WIKIDATA_PROPS.IMAGE]?.[0];
      if (imageClaim?.mainsnak?.datavalue?.value) {
        const filename = String(imageClaim.mainsnak.datavalue.value);
        const encoded = encodeURIComponent(filename.replace(/ /g, "_"));
        const photoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=400`;
        await db.politician.update({
          where: { id: mayor.id },
          data: { photoUrl, photoSource: "wikidata" },
        });
        stats.wikidataPhotos++;
      }

      // Party via P102
      if (!mayor.currentPartyId) {
        const partyClaims = entity?.claims?.P102;
        if (partyClaims?.length) {
          const currentClaim =
            partyClaims.find(
              (c: { qualifiers?: Record<string, unknown[]> }) => !c.qualifiers?.P582
            ) ?? partyClaims[0];
          const rawValue = currentClaim?.mainsnak?.datavalue?.value;
          const partyQid =
            rawValue && typeof rawValue === "object" && "id" in rawValue ? rawValue.id : null;
          if (partyQid) {
            const partySlug = WD_PARTY_TO_SLUG[partyQid];
            const partyId = partySlug ? partyMap.get(partySlug) : null;
            if (partyId) {
              await setCurrentParty(mayor.id, partyId);
              stats.wikidataParties++;
            }
          }
        }
      }

      if ((i + 1) % 100 === 0) {
        console.log(
          `[Wikidata] ${i + 1}/${toProcess.length}: ${stats.wikidataFound} found, ${stats.wikidataPhotos} photos, ${stats.wikidataParties} parties`
        );
      }
    } catch (error) {
      console.error(`[Wikidata] Error for ${mayor.fullName}: ${error}`);
      stats.errors++;
    }
  }

  console.log(
    `[Wikidata] Done: ${stats.wikidataFound} found, ${stats.wikidataPhotos} photos, ${stats.wikidataParties} parties`
  );
}

async function enrichHATVP(stats: EnrichStats, options: { dryRun?: boolean }): Promise<void> {
  const { dryRun = false } = options;

  const mayors = await db.politician.findMany({
    where: {
      publicationStatus: "DRAFT",
      mandates: { some: { type: "MAIRE", isCurrent: true } },
      externalIds: { none: { source: "HATVP" } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      localOffices: {
        where: { role: "MAIRE", isCurrent: true },
        select: { commune: { select: { population: true } } },
        take: 1,
      },
    },
  });

  const eligible = mayors.filter((m) => (m.localOffices[0]?.commune?.population ?? 0) >= 20000);
  console.log(`[HATVP] ${eligible.length} DRAFT maires in communes >= 20K without HATVP`);

  if (dryRun || eligible.length === 0) return;

  console.log("[HATVP] Fetching CSV...");
  const res = await fetch("https://www.hatvp.fr/livraison/opendata/liste.csv");
  const csv = await res.text();
  const rows = parse(csv, { columns: true, delimiter: ";", skip_empty_lines: true }) as Record<
    string,
    string
  >[];
  console.log(`[HATVP] CSV loaded: ${rows.length} rows`);

  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const DOC_TYPE_MAP: Record<string, string> = {
    di: "INTERETS",
    dim: "INTERETS",
    dia: "INTERETS",
    diam: "INTERETS",
    dsp: "PATRIMOINE_DEBUT_MANDAT",
    dspm: "PATRIMOINE_MODIFICATION",
    dspfm: "PATRIMOINE_FIN_MANDAT",
  };

  for (const m of eligible) {
    const matches = rows.filter(
      (r) =>
        normalize(r.nom || "") === normalize(m.lastName) &&
        normalize(r.prenom || "") === normalize(m.firstName)
    );

    if (matches.length === 0) continue;

    const classements = [...new Set(matches.map((r) => r.classement))];
    if (classements.length > 1) {
      console.log(`[HATVP] SKIP ${m.fullName} - ${classements.length} classements (homonyme?)`);
      continue;
    }

    const urlDossier = matches[0]!.url_dossier;
    if (!urlDossier) continue;

    const externalIdValue = urlDossier.replace(/^\//, "");
    await db.externalId.createMany({
      data: [
        {
          politicianId: m.id,
          source: DataSource.HATVP,
          externalId: externalIdValue,
          url: `https://www.hatvp.fr${urlDossier}`,
        },
      ],
      skipDuplicates: true,
    });
    stats.hatvpCreated++;

    for (const row of matches) {
      const docType = row.type_document?.toLowerCase();
      if (!docType) continue;
      const mappedType = DOC_TYPE_MAP[docType];
      if (!mappedType) continue;

      const dateStr = row.date_publication || row.date_depot || "";
      let year = 0;
      if (dateStr.includes("/")) year = parseInt(dateStr.split("/").pop() || "0");
      else if (dateStr.length >= 4) year = parseInt(dateStr.slice(0, 4));
      if (!year) continue;

      try {
        const hatvpUrl = row.open_data
          ? `https://www.hatvp.fr/livraison/dossiers/${row.open_data}`
          : `https://www.hatvp.fr${urlDossier}`;
        await db.declaration.upsert({
          where: {
            politicianId_type_year: {
              politicianId: m.id,
              type: mappedType as DeclarationType,
              year,
            },
          },
          create: { politicianId: m.id, type: mappedType as DeclarationType, year, hatvpUrl },
          update: {},
        });
        stats.hatvpDeclarations++;
      } catch {
        // skip constraint errors
      }
    }
  }

  console.log(
    `[HATVP] Done: ${stats.hatvpCreated} ExternalIds, ${stats.hatvpDeclarations} declarations`
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipWikidata = args.includes("--skip-wikidata");
  const skipHatvp = args.includes("--skip-hatvp");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]!) : undefined;

  console.log("=== Enrich New Maires ===");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  if (limit) console.log(`Wikidata limit: ${limit}`);

  const stats: EnrichStats = {
    wikidataFound: 0,
    wikidataPhotos: 0,
    wikidataParties: 0,
    hatvpCreated: 0,
    hatvpDeclarations: 0,
    errors: 0,
  };

  if (!skipWikidata) {
    await enrichWikidata(stats, { limit, dryRun });
  }

  if (!skipHatvp) {
    await enrichHATVP(stats, { dryRun });
  }

  console.log("\n=== Results ===");
  console.log(
    `Wikidata: ${stats.wikidataFound} found, ${stats.wikidataPhotos} photos, ${stats.wikidataParties} parties`
  );
  console.log(
    `HATVP:    ${stats.hatvpCreated} ExternalIds, ${stats.hatvpDeclarations} declarations`
  );
  console.log(`Errors:   ${stats.errors}`);

  await db.$disconnect();
}
main().catch(console.error);
