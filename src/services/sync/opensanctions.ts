import { DataSource } from "@/generated/prisma";
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
