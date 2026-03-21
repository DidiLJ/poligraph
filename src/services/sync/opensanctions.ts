import { createReadStream, createWriteStream } from "fs";
import { unlink } from "fs/promises";
import { get } from "https";
import { tmpdir } from "os";
import { join } from "path";
import { createInterface } from "readline";
import { pipeline } from "stream/promises";

import { DataSource, Judgement } from "@/generated/prisma";
import { db } from "@/lib/db";
import { resolveBatch } from "@/lib/identity";
import type { ResolveInput } from "@/lib/identity";

// --- FtM types ---

interface FtmEntity {
  id: string;
  caption: string;
  schema: string;
  properties: Record<string, string[]>;
  datasets: string[];
  referents: string[];
  target: boolean;
  first_seen: string;
  last_seen: string;
  last_change: string;
}

export interface ParsedPerson {
  entityId: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  gender: string | null;
  datasets: string[];
  url: string;
}

// --- Pure parsing functions ---

function parseBirthDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  // Partial dates: "1965" -> 1965-01-01, "1965-03" -> 1965-03-01
  if (/^\d{4}$/.test(raw)) return new Date(`${raw}-01-01`);
  if (/^\d{4}-\d{2}$/.test(raw)) return new Date(`${raw}-01`);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export function parseFtmPerson(entity: FtmEntity): ParsedPerson | null {
  if (entity.schema !== "Person") return null;

  const firstName = entity.properties.firstName?.[0];
  const lastName = entity.properties.lastName?.[0];
  if (!firstName || !lastName) return null;

  return {
    entityId: entity.id,
    firstName,
    lastName,
    birthDate: parseBirthDate(entity.properties.birthDate?.[0]),
    gender: entity.properties.gender?.[0] ?? null,
    datasets: entity.datasets,
    url: `https://www.opensanctions.org/entities/${entity.id}/`,
  };
}

export function toResolveInput(person: ParsedPerson): ResolveInput {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    birthDate: person.birthDate,
    source: DataSource.OPENSANCTIONS,
    sourceId: person.entityId,
    gender: person.gender,
    context: { datasets: person.datasets },
  };
}

// --- Sync orchestrator ---

const PEPS_NDJSON_URL = "https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json";

export interface OpenSanctionsSyncStats {
  downloaded: number;
  frenchFiltered: number;
  matched: number;
  review: number;
  notFound: number;
  errors: string[];
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) return reject(new Error("Redirect without location"));
        file.close();
        return downloadFile(redirectUrl, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      pipeline(response, file).then(resolve).catch(reject);
    }).on("error", reject);
  });
}

async function parseNdjsonFile(
  filePath: string
): Promise<{ persons: ParsedPerson[]; totalLines: number }> {
  const persons: ParsedPerson[] = [];
  let totalLines = 0;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalLines++;

    try {
      const entity = JSON.parse(line) as FtmEntity;
      if (entity.schema !== "Person" || !entity.properties.country?.includes("fr")) {
        continue;
      }

      const parsed = parseFtmPerson(entity);
      if (parsed) persons.push(parsed);
    } catch {
      // Skip malformed lines
    }
  }

  return { persons, totalLines };
}

export async function syncOpenSanctions(options?: {
  limit?: number;
}): Promise<OpenSanctionsSyncStats> {
  const stats: OpenSanctionsSyncStats = {
    downloaded: 0,
    frenchFiltered: 0,
    matched: 0,
    review: 0,
    notFound: 0,
    errors: [],
  };

  // 1. Download NDJSON to temp file
  const tmpPath = join(tmpdir(), `opensanctions-peps-${Date.now()}.ndjson`);
  console.log(`Downloading PEPs dataset to ${tmpPath}...`);

  try {
    await downloadFile(PEPS_NDJSON_URL, tmpPath);
  } catch (err) {
    stats.errors.push(`Download failed: ${err}`);
    return stats;
  }

  // 2. Stream-parse and filter French persons
  console.log("Parsing NDJSON and filtering French persons...");
  const { persons, totalLines } = await parseNdjsonFile(tmpPath);
  stats.downloaded = totalLines;
  stats.frenchFiltered = persons.length;

  console.log(`Parsed ${totalLines} entities, ${persons.length} French persons`);

  // 3. Apply limit if specified
  const toResolve = options?.limit ? persons.slice(0, options.limit) : persons;

  // 4. Resolve against Poligraph politicians
  console.log(`Resolving ${toResolve.length} persons...`);
  const inputs = toResolve.map(toResolveInput);

  const batchResult = await resolveBatch({
    inputs,
    sourceType: DataSource.OPENSANCTIONS,
    onProgress: (processed, total) => {
      if (processed % 5000 === 0) {
        console.log(`  Progress: ${processed}/${total}`);
      }
    },
  });

  // 5. Upsert ExternalIds for auto-matches
  for (const result of batchResult.results) {
    if (result.decision === Judgement.SAME && result.politicianId) {
      const person = toResolve.find((p) => p.entityId === result.sourceId);
      if (!person) continue;

      try {
        await db.externalId.upsert({
          where: {
            source_externalId: {
              source: DataSource.OPENSANCTIONS,
              externalId: person.entityId,
            },
          },
          create: {
            politicianId: result.politicianId,
            source: DataSource.OPENSANCTIONS,
            externalId: person.entityId,
            url: person.url,
            confidence: result.confidence,
            matchedBy: result.method,
            metadata: { datasets: person.datasets },
          },
          update: {
            politicianId: result.politicianId,
            url: person.url,
            confidence: result.confidence,
            metadata: { datasets: person.datasets },
          },
        });
        stats.matched++;
      } catch (err) {
        stats.errors.push(`ExternalId upsert failed for ${person.entityId}: ${err}`);
      }
    } else if (result.decision === Judgement.UNDECIDED) {
      stats.review++;
    } else {
      stats.notFound++;
    }
  }

  // 6. Cleanup temp file
  try {
    await unlink(tmpPath);
  } catch {
    // Non-critical
  }

  console.log(
    `Done: ${stats.matched} matched, ${stats.review} for review, ${stats.notFound} not found`
  );
  return stats;
}
