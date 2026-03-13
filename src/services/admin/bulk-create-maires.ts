import { db } from "@/lib/db";
import { DataSource, MandateType, PublicationStatus } from "@/generated/prisma";
import { generateSlug, generateUniqueSlug } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Pure functions: deduplication
// ---------------------------------------------------------------------------

function normalizeKey(fullName: string, birthDate: Date): string {
  const slug = fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug}|${birthDate.toISOString().slice(0, 10)}`;
}

export function findExistingMatch(
  candidate: { fullName: string; birthDate: Date },
  existingMap: Map<string, string>
): string | null {
  const key = normalizeKey(candidate.fullName, candidate.birthDate);
  return existingMap.get(key) ?? null;
}

export function deduplicateIntraBatch<T extends { id: string; fullName: string; birthDate: Date }>(
  batch: T[]
): { unique: T[]; duplicateIds: string[] } {
  const seen = new Map<string, T>();
  const duplicateIds: string[] = [];

  for (const item of batch) {
    const key = normalizeKey(item.fullName, item.birthDate);
    if (seen.has(key)) {
      duplicateIds.push(item.id);
    } else {
      seen.set(key, item);
    }
  }

  return { unique: [...seen.values()], duplicateIds };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocalOfficialRow {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: string | null;
  birthDate: Date | null;
  communeId: string | null;
  departmentCode: string;
  externalId: string | null;
  mandateStart: Date | null;
  functionStart: Date | null;
  photoUrl: string | null;
  partyId: string | null;
  commune: { name: string } | null;
}

export interface BulkCreateStats {
  total: number;
  created: number;
  linked: number;
  duplicatesSkipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Core: create a single politician from LocalOfficial (no Wikidata)
// ---------------------------------------------------------------------------

async function createPoliticianFromOfficial(
  official: LocalOfficialRow
): Promise<{ politicianId: string; slug: string }> {
  const baseSlug = generateSlug(official.fullName);
  const slug = await generateUniqueSlug(baseSlug, async (s) => {
    const count = await db.politician.count({ where: { slug: s } });
    return count > 0;
  });

  const politician = await db.politician.create({
    data: {
      slug,
      civility: official.gender === "F" ? "Mme" : "M.",
      firstName: official.firstName,
      lastName: official.lastName,
      fullName: official.fullName,
      birthDate: official.birthDate,
      photoUrl: official.photoUrl,
      photoSource: official.photoUrl ? "rne" : null,
      currentPartyId: official.partyId,
      publicationStatus: PublicationStatus.DRAFT,
    },
  });

  // ExternalId (RNE)
  if (official.externalId) {
    await db.externalId.createMany({
      data: [
        {
          politicianId: politician.id,
          source: DataSource.RNE,
          externalId: official.externalId,
        },
      ],
      skipDuplicates: true,
    });
  }

  // Link LocalOfficial
  await db.localOfficial.update({
    where: { id: official.id },
    data: { politicianId: politician.id },
  });

  // Mandate MAIRE
  await db.mandate.create({
    data: {
      politicianId: politician.id,
      type: MandateType.MAIRE,
      title: `Maire de ${official.commune?.name ?? "commune inconnue"}`,
      institution: official.commune?.name ?? "Commune",
      startDate: official.functionStart ?? official.mandateStart ?? new Date(),
      isCurrent: true,
      departmentCode: official.departmentCode,
      constituency: official.commune
        ? `${official.commune.name} (${official.communeId})`
        : undefined,
      source: DataSource.RNE,
    },
  });

  return { politicianId: politician.id, slug };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 500;

export async function bulkCreateMaires(options?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<BulkCreateStats> {
  const { dryRun = false, limit } = options ?? {};
  const stats: BulkCreateStats = {
    total: 0,
    created: 0,
    linked: 0,
    duplicatesSkipped: 0,
    errors: 0,
  };

  // 1. Pre-load existing politicians for dedup
  console.log("[Phase 1] Loading existing politicians for dedup...");
  const existingPoliticians = await db.politician.findMany({
    select: { id: true, fullName: true, birthDate: true },
    where: { birthDate: { not: null } },
  });

  const existingMap = new Map<string, string>();
  for (const p of existingPoliticians) {
    if (p.birthDate) {
      const key = normalizeKey(p.fullName, p.birthDate);
      existingMap.set(key, p.id);
    }
  }
  console.log(`[Phase 1] ${existingMap.size} existing politicians loaded for dedup`);

  // 2. Load unlinked MAIRE LocalOfficials
  const officials = await db.localOfficial.findMany({
    where: { role: "MAIRE", isCurrent: true, politicianId: null },
    include: { commune: { select: { name: true } } },
    orderBy: { departmentCode: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  stats.total = officials.length;
  console.log(`[Phase 1] ${officials.length} unlinked MAIRE LocalOfficials to process`);

  if (dryRun) {
    console.log("[Phase 1] DRY RUN - no changes will be made");
    return stats;
  }

  // 3. Process in chunks
  for (let i = 0; i < officials.length; i += CHUNK_SIZE) {
    const chunk = officials.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(officials.length / CHUNK_SIZE);

    // Intra-batch dedup
    const validChunk = chunk.filter(
      (o): o is typeof o & { birthDate: Date } => o.birthDate !== null
    );
    const { unique, duplicateIds } = deduplicateIntraBatch(validChunk);
    stats.duplicatesSkipped += duplicateIds.length;

    // Map intra-batch duplicates to first occurrence
    const duplicateMap = new Map<string, string[]>();
    for (const dupId of duplicateIds) {
      const dup = chunk.find((o) => o.id === dupId)!;
      const key = normalizeKey(dup.fullName, dup.birthDate!);
      const first = unique.find((u) => normalizeKey(u.fullName, u.birthDate) === key)!;
      const existing = duplicateMap.get(first.id) ?? [];
      existing.push(dupId);
      duplicateMap.set(first.id, existing);
    }

    for (const official of unique) {
      try {
        // Check against existing politicians
        const existingId = findExistingMatch(
          { fullName: official.fullName, birthDate: official.birthDate },
          existingMap
        );

        if (existingId) {
          await db.localOfficial.update({
            where: { id: official.id },
            data: { politicianId: existingId },
          });
          stats.linked++;

          for (const dupId of duplicateMap.get(official.id) ?? []) {
            await db.localOfficial.update({
              where: { id: dupId },
              data: { politicianId: existingId },
            });
          }
          continue;
        }

        // Create new politician
        const { politicianId } = await createPoliticianFromOfficial(official);
        stats.created++;

        // Add to dedup map for subsequent chunks
        existingMap.set(normalizeKey(official.fullName, official.birthDate), politicianId);

        // Link intra-batch duplicates
        for (const dupId of duplicateMap.get(official.id) ?? []) {
          await db.localOfficial.update({
            where: { id: dupId },
            data: { politicianId },
          });
          stats.linked++;
        }
      } catch (error) {
        console.error(`[Phase 1] Error processing ${official.fullName}: ${error}`);
        stats.errors++;
      }
    }

    // Handle officials with null birthDate (cannot dedup, just create)
    const nullBirthOfficials = chunk.filter((o) => o.birthDate === null);
    for (const official of nullBirthOfficials) {
      try {
        await createPoliticianFromOfficial(official);
        stats.created++;
      } catch (error) {
        console.error(`[Phase 1] Error processing ${official.fullName}: ${error}`);
        stats.errors++;
      }
    }

    console.log(
      `[Phase 1] Chunk ${chunkNum}/${totalChunks}: ${stats.created} created, ${stats.linked} linked, ${stats.duplicatesSkipped} dedup skips, ${stats.errors} errors`
    );
  }

  console.log(
    `\n[Phase 1] DONE: ${stats.created} created, ${stats.linked} linked, ${stats.duplicatesSkipped} dedup, ${stats.errors} errors`
  );
  return stats;
}
