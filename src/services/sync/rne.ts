import { db } from "@/lib/db";
import { DataSource, Judgement, MandateType, PublicationStatus } from "@/generated/prisma";
import { parse } from "csv-parse/sync";
import type { MaireRNECSV, RNESyncResult } from "./types";
import { HTTPClient } from "@/lib/api/http-client";
import { DATA_GOUV_RATE_LIMIT_MS } from "@/config/rate-limits";
import { NUANCE_POLITIQUE_MAPPING } from "@/config/labels";
import { resolveBatch } from "@/lib/identity";
import { generateSlug } from "@/lib/utils";

const client = new HTTPClient({ rateLimitMs: DATA_GOUV_RATE_LIMIT_MS });

const RNE_MAIRES_CSV_URL =
  "https://static.data.gouv.fr/resources/repertoire-national-des-elus-1/20251223-104211/elus-maires-mai.csv";

/**
 * Parse a French date string (DD/MM/YYYY) to a Date object
 */
function parseFrenchDate(str: string): Date | null {
  if (!str || str.trim() === "") return null;
  const parts = str.trim().split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  // Validate the date is reasonable
  if (isNaN(date.getTime()) || year < 1900 || year > 2100) return null;
  return date;
}

/**
 * Build a 5-character INSEE code from department code + commune code.
 *
 * Unlike the candidatures CSV (which has a separate 3-digit commune suffix),
 * the RNE maires CSV's "Code de la commune" is already the FULL 5-digit INSEE
 * code (e.g., "01001"). We detect this and use it directly.
 */
function buildInseeCode(deptCode: string, communeCode: string): string {
  const trimmedDept = deptCode.trim();
  const trimmedCommune = communeCode.trim();

  // RNE CSV "Code de la commune" is already a full 5-digit INSEE code.
  // Some communes have codes from a neighboring department (communes nouvelles
  // merged across boundaries), so we can't check the dept prefix.
  if (trimmedCommune.length === 5) {
    return trimmedCommune;
  }

  // Fallback: build from dept + commune suffix (candidatures-style CSV)
  let code: string;
  if (trimmedDept.length === 3) {
    code = trimmedDept + trimmedCommune.padStart(2, "0");
  } else {
    code = trimmedDept + trimmedCommune.padStart(3, "0");
  }

  if (code.length !== 5) {
    console.warn(
      `buildInseeCode: unexpected length ${code.length} for dept="${deptCode}" commune="${communeCode}" -> "${code}"`
    );
  }

  return code;
}

/**
 * Normalize a name to title case, handling compound names with spaces and hyphens.
 */
function normalizeName(name: string): string {
  return name
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Fetch and parse RNE maires CSV
 */
async function fetchRNECSV(): Promise<MaireRNECSV[]> {
  console.log(`Fetching RNE maires data from: ${RNE_MAIRES_CSV_URL}`);

  const { data: csvText } = await client.getText(RNE_MAIRES_CSV_URL);
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ";",
    bom: true,
  }) as MaireRNECSV[];

  console.log(`Parsed ${records.length} maire records`);
  return records;
}

/**
 * Sync RNE maires data — 4-phase pipeline:
 *   Phase 0: Snapshot current mayors from DB (MAIRE mandates with MandateLocal)
 *   Phase 1: Parse CSV + upsert Politician + Mandate + MandateLocal (500-row batches)
 *   Phase 2: Reconcile newly created RNE Politicians against existing national Politicians
 *   Phase 3: Close stale mandates no longer in CSV
 */
export async function syncRNEMaires(
  options: {
    dryRun?: boolean;
    limit?: number;
    verbose?: boolean;
  } = {}
): Promise<RNESyncResult> {
  const { dryRun = false, limit, verbose = false } = options;

  let officialsCreated = 0;
  let officialsUpdated = 0;
  let officialsClosed = 0;
  let mandatesCreated = 0;
  let mandatesUpdated = 0;
  let mandatesClosed = 0;
  let politiciansMatched = 0;
  let politiciansNotFound = 0;
  const errors: string[] = [];

  // ========================================
  // Phase 0: Snapshot current MAIRE mandates
  // ========================================
  console.log("\n--- Phase 0: Snapshot current mayors from DB ---");
  const currentMayorsFromDB = await db.mandate.findMany({
    where: {
      type: MandateType.MAIRE,
      isCurrent: true,
      localData: { isNot: null },
    },
    select: {
      id: true,
      politicianId: true,
      localData: {
        select: { communeId: true, rneExternalId: true },
      },
    },
  });

  console.log(`  Found ${currentMayorsFromDB.length} current mayor mandates in DB`);

  const seenCommuneIds = new Set<string>();
  // Map<inseeCode, communeName> — populated during Phase 1 parsing
  const communeNameByInsee = new Map<string, string>();

  // Pre-load existing commune IDs for FK validation
  const existingCommunes = await db.commune.findMany({
    select: { id: true },
  });
  const communeIdSet = new Set(existingCommunes.map((c) => c.id));
  console.log(`  Loaded ${communeIdSet.size} existing communes for FK validation`);

  // ========================================
  // Phase 1: Parse CSV + upsert Politician + Mandate + MandateLocal
  // ========================================
  console.log("\n--- Phase 1: Parse CSV + upsert Politician + Mandate + MandateLocal ---");
  const records = await fetchRNECSV();
  const toProcess = limit ? records.slice(0, limit) : records;

  console.log(`Processing ${toProcess.length} maires...`);

  interface ParsedRow {
    inseeCode: string;
    communeId: string | null;
    communeLabel: string | null;
    firstName: string;
    lastName: string;
    fullName: string;
    civility: string | null;
    gender: string | null;
    birthDate: Date | null;
    deptCode: string;
    mandateStart: Date | null;
    functionStart: Date | null;
  }

  const parsedRows: ParsedRow[] = [];
  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];
    const nom = row!["Nom de l'élu"];
    const prenom = row!["Prénom de l'élu"];
    const codeCommune = row!["Code de la commune"];
    const deptCode = row!["Code du département"];

    if (!nom || !prenom) {
      errors.push(`Row ${i + 1}: missing name`);
      continue;
    }
    if (!deptCode || !codeCommune) {
      errors.push(`Row ${i + 1}: missing department or commune code for ${prenom} ${nom}`);
      continue;
    }

    const inseeCode = buildInseeCode(deptCode, codeCommune);
    seenCommuneIds.add(inseeCode);
    const communeLabel = row!["Libellé de la commune"]?.trim() || null;
    if (communeLabel) communeNameByInsee.set(inseeCode, communeLabel);
    const communeId = communeIdSet.has(inseeCode) ? inseeCode : null;
    const normalizedFirstName = normalizeName(prenom);
    const normalizedLastName = normalizeName(nom);
    const genderCode = row!["Code sexe"];
    const gender = genderCode === "M" ? "M" : genderCode === "F" ? "F" : null;

    parsedRows.push({
      inseeCode,
      communeId,
      communeLabel,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      fullName: `${normalizedFirstName} ${normalizedLastName}`,
      civility: gender === "F" ? "Mme" : gender === "M" ? "M." : null,
      gender,
      birthDate: parseFrenchDate(row!["Date de naissance"]),
      deptCode,
      mandateStart: parseFrenchDate(row!["Date de début du mandat"]),
      functionStart: parseFrenchDate(row!["Date de début de la fonction"]),
    });
  }

  // Deduplicate by inseeCode (keep last occurrence — latest data wins)
  const deduped = new Map<string, ParsedRow>();
  for (const row of parsedRows) {
    deduped.set(row.inseeCode, row);
  }
  const uniqueRows = [...deduped.values()];
  if (uniqueRows.length < parsedRows.length) {
    console.log(
      `  Deduplicated: ${parsedRows.length} → ${uniqueRows.length} (${parsedRows.length - uniqueRows.length} duplicates)`
    );
  }

  if (dryRun) {
    console.log(`  [DRY-RUN] Would upsert ${uniqueRows.length} maires`);
    if (verbose) {
      for (const r of uniqueRows.slice(0, 10)) {
        console.log(`  [DRY-RUN] ${r.fullName} (${r.inseeCode})`);
      }
    }
    officialsCreated = uniqueRows.length;
  } else {
    // Build lookup of existing MandateLocal by rneExternalId for efficient upsert
    const existingByInsee = new Map<
      string,
      { mandateId: string; politicianId: string; mandateLocalId: string }
    >();
    const existingLocalData = await db.mandateLocal.findMany({
      where: { rneExternalId: { not: null } },
      select: {
        id: true,
        rneExternalId: true,
        mandate: { select: { id: true, politicianId: true } },
      },
    });
    for (const local of existingLocalData) {
      if (local.rneExternalId) {
        existingByInsee.set(local.rneExternalId, {
          mandateId: local.mandate.id,
          politicianId: local.mandate.politicianId,
          mandateLocalId: local.id,
        });
      }
    }
    console.log(`  Loaded ${existingByInsee.size} existing MandateLocal records by INSEE code`);

    const BATCH_SIZE = 500;
    for (let start = 0; start < uniqueRows.length; start += BATCH_SIZE) {
      const chunk = uniqueRows.slice(start, start + BATCH_SIZE);

      for (const r of chunk) {
        try {
          const existing = existingByInsee.get(r.inseeCode);

          if (existing) {
            // Update existing Mandate fields
            const startDate = r.functionStart || r.mandateStart || new Date(2020, 4, 18);
            const communeLabel = r.communeLabel;
            const mandateTitle = communeLabel
              ? `Maire de ${communeLabel}`
              : `Maire (${r.inseeCode})`;
            const constituency = communeLabel ? `${communeLabel} (${r.inseeCode})` : r.inseeCode;

            await db.mandate.update({
              where: { id: existing.mandateId },
              data: {
                title: mandateTitle,
                constituency,
                departmentCode: r.deptCode,
                startDate,
                isCurrent: true,
                endDate: null,
              },
            });

            // Update MandateLocal fields
            await db.mandateLocal.update({
              where: { id: existing.mandateLocalId },
              data: {
                communeId: r.communeId,
                functionStart: r.functionStart,
              },
            });

            // Update Politician fields (civility, birthDate)
            await db.politician.update({
              where: { id: existing.politicianId },
              data: {
                civility: r.civility,
                birthDate: r.birthDate,
              },
            });

            mandatesUpdated++;
            officialsUpdated++;
          } else {
            // Create new Politician + Mandate + MandateLocal
            const startDate = r.functionStart || r.mandateStart || new Date(2020, 4, 18);
            const communeLabel = r.communeLabel;
            const mandateTitle = communeLabel
              ? `Maire de ${communeLabel}`
              : `Maire (${r.inseeCode})`;
            const constituency = communeLabel ? `${communeLabel} (${r.inseeCode})` : r.inseeCode;

            // Generate a unique slug: "prenom-nom" with fallback suffix
            const baseSlug = generateSlug(`${r.firstName} ${r.lastName}`);
            // Check for slug collision and append insee suffix if needed
            const existingSlug = await db.politician.findUnique({
              where: { slug: baseSlug },
              select: { id: true },
            });
            const slug = existingSlug ? `${baseSlug}-${r.inseeCode}` : baseSlug;

            const newPolitician = await db.politician.create({
              data: {
                slug,
                civility: r.civility,
                firstName: r.firstName,
                lastName: r.lastName,
                fullName: r.fullName,
                birthDate: r.birthDate,
                source: DataSource.RNE,
                publicationStatus: PublicationStatus.PUBLISHED,
                mandates: {
                  create: {
                    type: MandateType.MAIRE,
                    title: mandateTitle,
                    institution: "Commune",
                    constituency,
                    departmentCode: r.deptCode,
                    startDate,
                    isCurrent: true,
                    source: DataSource.RNE,
                    localData: {
                      create: {
                        communeId: r.communeId,
                        functionStart: r.functionStart,
                        rneExternalId: r.inseeCode,
                      },
                    },
                  },
                },
              },
            });

            if (verbose) {
              console.log(
                `  Created politician: ${r.fullName} (${r.inseeCode}) -> ${newPolitician.id}`
              );
            }

            mandatesCreated++;
            officialsCreated++;
          }
        } catch (err) {
          errors.push(`Upsert failed for ${r.fullName} (${r.inseeCode}): ${err}`);
        }
      }

      if ((start + BATCH_SIZE) % 5000 < BATCH_SIZE) {
        console.log(
          `  Progress: ${Math.min(start + BATCH_SIZE, uniqueRows.length)}/${uniqueRows.length}`
        );
      }
    }
  }

  console.log(
    `  Phase 1 complete: ${officialsCreated} created, ${officialsUpdated} updated, ${errors.length} errors`
  );

  if (dryRun) {
    console.log("\n[DRY-RUN] Skipping phases 2-3");
    return {
      success: errors.length === 0,
      officialsCreated,
      officialsUpdated,
      officialsClosed: 0,
      mandatesCreated: 0,
      mandatesUpdated: 0,
      mandatesClosed: 0,
      politiciansMatched: 0,
      politiciansNotFound: 0,
      errors,
    };
  }

  // ========================================
  // Phase 2: Reconcile new RNE Politicians against existing national Politicians
  // ========================================
  console.log(
    "\n--- Phase 2: Reconcile new RNE Politicians with existing national Politicians ---"
  );

  // Find newly created RNE Politicians that have no external IDs (not yet linked nationally)
  const rneOnlyPoliticians = await db.politician.findMany({
    where: {
      source: DataSource.RNE,
      externalIds: { none: {} },
      mandates: {
        some: { type: MandateType.MAIRE, isCurrent: true, localData: { isNot: null } },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      mandates: {
        where: { type: MandateType.MAIRE, isCurrent: true },
        select: {
          id: true,
          departmentCode: true,
          localData: { select: { rneExternalId: true, communeId: true } },
        },
        take: 1,
      },
    },
  });

  console.log(`  Found ${rneOnlyPoliticians.length} RNE-only Politicians to reconcile`);

  if (rneOnlyPoliticians.length > 0) {
    const politicianBySourceId = new Map<string, (typeof rneOnlyPoliticians)[number]>();
    const resolveInputs = rneOnlyPoliticians.map((politician) => {
      const mandate = politician.mandates[0];
      const sourceId =
        mandate?.localData?.rneExternalId || mandate?.localData?.communeId || politician.id;
      politicianBySourceId.set(sourceId, politician);
      return {
        firstName: politician.firstName,
        lastName: politician.lastName,
        birthDate: politician.birthDate,
        source: DataSource.RNE,
        sourceId,
        department: mandate?.departmentCode || undefined,
        mandateType: MandateType.MAIRE,
        context: {
          commune: communeNameByInsee.get(mandate?.localData?.rneExternalId ?? "") ?? null,
        },
      };
    });

    const batchResult = await resolveBatch({
      sourceType: DataSource.RNE,
      inputs: resolveInputs,
      onProgress: (processed, total) => {
        if (processed % 5000 === 0 || processed === total) {
          console.log(`  Phase 2 progress: ${processed}/${total}`);
        }
      },
    });

    console.log(
      `  Phase 2 complete: ${batchResult.stats.matched} matched, ${batchResult.stats.review} review, ${batchResult.stats.notFound} not found, ${batchResult.stats.blocked} blocked`
    );

    politiciansNotFound = batchResult.stats.notFound + batchResult.stats.blocked;

    // For SAME matches: transfer mandates from the RNE stub to the existing politician,
    // then delete the stub.
    for (const resolveResult of batchResult.results) {
      const existingPoliticianId = resolveResult.politicianId;
      if (!existingPoliticianId) continue;
      if (resolveResult.decision !== Judgement.SAME) continue;

      const rnePolitician = politicianBySourceId.get(resolveResult.sourceId);
      if (!rnePolitician) continue;
      if (rnePolitician.id === existingPoliticianId) continue; // already the same record

      politiciansMatched++;

      try {
        // Transfer all MAIRE mandates from the RNE stub to the existing politician
        await db.mandate.updateMany({
          where: { politicianId: rnePolitician.id },
          data: { politicianId: existingPoliticianId },
        });

        // Delete the RNE stub (no mandates, no external IDs remain)
        await db.politician.delete({ where: { id: rnePolitician.id } });

        if (verbose) {
          console.log(
            `  Merged: RNE stub ${rnePolitician.id} (${rnePolitician.firstName} ${rnePolitician.lastName}) -> existing politician ${existingPoliticianId} [${resolveResult.method}, confidence=${resolveResult.confidence}]`
          );
        }
      } catch (err) {
        errors.push(
          `Merge failed for ${rnePolitician.firstName} ${rnePolitician.lastName}: ${err}`
        );
      }
    }
  }

  // ========================================
  // Phase 3: Close stale mandates
  // ========================================
  console.log("\n--- Phase 3: Close stale mandates ---");

  // Find MAIRE mandates that were in the snapshot but whose INSEE code is no longer in the CSV
  const staleMandates = currentMayorsFromDB.filter((m) => {
    const identifier = m.localData?.rneExternalId || m.localData?.communeId;
    return identifier && !seenCommuneIds.has(identifier);
  });

  console.log(`  Found ${staleMandates.length} stale mandates to close`);

  for (const stale of staleMandates) {
    try {
      await db.mandate.update({
        where: { id: stale.id },
        data: { isCurrent: false, endDate: new Date() },
      });
      mandatesClosed++;
      officialsClosed++;
    } catch (error) {
      errors.push(`Close stale mandate ${stale.id}: ${error}`);
    }
  }

  console.log(`  Phase 3 complete: ${mandatesClosed} mandates closed`);

  // ========================================
  // Summary
  // ========================================
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results:`);
  console.log(`  Maires created:    ${officialsCreated}`);
  console.log(`  Maires updated:    ${officialsUpdated}`);
  console.log(`  Maires closed:     ${officialsClosed}`);
  console.log(`  Mandates created:  ${mandatesCreated}`);
  console.log(`  Mandates updated:  ${mandatesUpdated}`);
  console.log(`  Mandates closed:   ${mandatesClosed}`);
  console.log(`  Politicians matched: ${politiciansMatched}`);
  console.log(`  Politicians not found: ${politiciansNotFound}`);
  console.log(`  Errors: ${errors.length}`);

  const totalUpserted = officialsCreated + officialsUpdated;
  if (totalUpserted > 100) {
    try {
      await db.platformUpdate.create({
        data: {
          title: `${totalUpserted.toLocaleString("fr-FR")} maires mis à jour depuis le RNE`,
          type: "DATA_IMPORT",
          metadata: { count: totalUpserted, entity: "maires" },
        },
      });
    } catch {
      console.warn("Failed to create platform update entry");
    }
  }

  return {
    success: errors.length === 0,
    officialsCreated,
    officialsUpdated,
    officialsClosed,
    mandatesCreated,
    mandatesUpdated,
    mandatesClosed,
    politiciansMatched,
    politiciansNotFound,
    errors,
  };
}

// ============================================
// Party resolution
// ============================================

const ENRICHED_COMMUNES_CSV_URL =
  "https://www.data.gouv.fr/api/1/datasets/r/ea5d6bc3-37d0-4884-a437-155a90c3e05f";

/**
 * Resolve party affiliations for maires using:
 * 1. Enriched communes CSV (data.gouv.fr) → nuance_politique → NUANCE_POLITIQUE_MAPPING → partyId
 * 2. Inherit from Politician.currentPartyId if already set on a matched national politician
 */
export async function resolveParties(options: { verbose?: boolean } = {}): Promise<{
  fromNuance: number;
  fromPolitician: number;
  unmapped: string[];
}> {
  const { verbose = false } = options;

  // Step 1: Fetch enriched communes CSV and build inseeCode → nuanceCode map
  console.log(`Fetching enriched communes from: ${ENRICHED_COMMUNES_CSV_URL}`);
  const { data: csvText } = await client.getText(ENRICHED_COMMUNES_CSV_URL);
  const enrichedRows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ",",
    bom: true,
  }) as Array<{
    cog_commune: string;
    nuance_politique: string;
    famille_nuance: string;
  }>;

  const nuanceMap = new Map<string, string>();
  for (const row of enrichedRows) {
    const code = row.cog_commune?.trim();
    const nuance = row.nuance_politique?.trim();
    if (code && nuance && nuance !== "NC" && nuance !== "LNC" && nuance !== "") {
      nuanceMap.set(code, nuance);
    }
  }
  console.log(`  Built nuance map: ${nuanceMap.size} communes with political nuance`);

  // Step 2: Pre-load parties by shortName for O(1) lookup
  const parties = await db.party.findMany({
    select: { id: true, shortName: true },
  });
  const partyByShortName = new Map<string, string>();
  for (const p of parties) {
    if (p.shortName) partyByShortName.set(p.shortName, p.id);
  }

  // Step 3: Find current MAIRE mandates where politician has no currentPartyId
  const mandates = await db.mandate.findMany({
    where: {
      type: MandateType.MAIRE,
      isCurrent: true,
      localData: { isNot: null },
      politician: { currentPartyId: null },
    },
    select: {
      id: true,
      politicianId: true,
      localData: { select: { rneExternalId: true } },
    },
  });

  console.log(`  Found ${mandates.length} maires without party to resolve`);

  let fromNuance = 0;
  const fromPolitician = 0;
  const unmappedNuances = new Set<string>();

  // Build batched updates: Map<partyId, politicianIds[]>
  const updatesByParty = new Map<string, string[]>();

  for (const mandate of mandates) {
    const rneId = mandate.localData?.rneExternalId;
    if (!rneId) continue;

    const nuance = nuanceMap.get(rneId);
    if (!nuance) continue;

    const shortName = NUANCE_POLITIQUE_MAPPING[nuance];
    if (!shortName) {
      unmappedNuances.add(`${nuance} (no mapping)`);
      continue;
    }

    const partyId = partyByShortName.get(shortName);
    if (!partyId) {
      unmappedNuances.add(`${nuance} → ${shortName} (no party in DB)`);
      continue;
    }

    const list = updatesByParty.get(partyId) || [];
    list.push(mandate.politicianId);
    updatesByParty.set(partyId, list);
    fromNuance++;
  }

  // Step 4: Batch UPDATE Politician.currentPartyId grouped by partyId
  for (const [partyId, politicianIds] of updatesByParty) {
    await db.politician.updateMany({
      where: { id: { in: politicianIds } },
      data: { currentPartyId: partyId },
    });
  }

  if (verbose && unmappedNuances.size > 0) {
    console.log(`  Unmapped nuances:`);
    for (const n of unmappedNuances) {
      console.log(`    - ${n}`);
    }
  }

  console.log(
    `  Party resolution complete: ${fromNuance} from nuance, ${fromPolitician} from politician, ${unmappedNuances.size} unmapped nuance codes`
  );

  return { fromNuance, fromPolitician, unmapped: [...unmappedNuances] };
}

/**
 * Get RNE sync statistics (queries Mandate + MandateLocal tables)
 */
export async function getRNEStats() {
  const totalMaires = await db.mandate.count({
    where: { type: MandateType.MAIRE, localData: { isNot: null } },
  });
  const totalWithNationalPresence = await db.mandate.count({
    where: {
      type: MandateType.MAIRE,
      localData: { isNot: null },
      politician: { externalIds: { some: {} } },
    },
  });
  const totalCurrent = await db.mandate.count({
    where: { type: MandateType.MAIRE, isCurrent: true, localData: { isNot: null } },
  });

  return { totalMaires, totalWithNationalPresence, totalCurrent };
}
