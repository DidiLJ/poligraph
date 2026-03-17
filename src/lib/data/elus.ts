import { cacheTag, cacheLife } from "next/cache";
import { LocalOfficialRole } from "@/generated/prisma";
import { db } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────

export interface EluSummary {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: string | null;
  birthDate: string | null;
  role: LocalOfficialRole;
  isCurrent: boolean;
  mandateStart: string | null;
  functionStart: string | null;
  commune: {
    inseeCode: string;
    name: string;
    departmentCode: string;
    departmentName: string;
    population: number | null;
  } | null;
  party: {
    shortName: string;
    color: string | null;
    slug: string | null;
  } | null;
  politician: {
    slug: string;
    fullName: string;
    photoUrl: string | null;
  } | null;
}

export interface EluDetail extends EluSummary {
  mandateEnd: string | null;
  partyLabel: string | null;
  source: string;
  externalId: string | null;
}

// ─── Shared select shapes ────────────────────────────────────────

const COMMUNE_SELECT = {
  id: true,
  name: true,
  departmentCode: true,
  departmentName: true,
  population: true,
} as const;

const PARTY_SELECT = {
  shortName: true,
  color: true,
  slug: true,
} as const;

const POLITICIAN_SELECT = {
  slug: true,
  fullName: true,
  photoUrl: true,
} as const;

// ─── Transform helpers ───────────────────────────────────────────

type RawElu = Awaited<ReturnType<typeof db.localOfficial.findFirst>> & {
  commune?: {
    id: string;
    name: string;
    departmentCode: string;
    departmentName: string;
    population: number | null;
  } | null;
  party?: { shortName: string; color: string | null; slug: string | null } | null;
  politician?: { slug: string; fullName: string; photoUrl: string | null } | null;
};

function toSummary(e: NonNullable<RawElu>): EluSummary {
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    fullName: e.fullName,
    gender: e.gender,
    birthDate: e.birthDate?.toISOString() ?? null,
    role: e.role,
    isCurrent: e.isCurrent,
    mandateStart: e.mandateStart?.toISOString() ?? null,
    functionStart: e.functionStart?.toISOString() ?? null,
    commune: e.commune
      ? {
          inseeCode: e.commune.id,
          name: e.commune.name,
          departmentCode: e.commune.departmentCode,
          departmentName: e.commune.departmentName,
          population: e.commune.population,
        }
      : null,
    party: e.party ?? null,
    politician: e.politician ?? null,
  };
}

function toDetail(e: NonNullable<RawElu>): EluDetail {
  return {
    ...toSummary(e),
    mandateEnd: e.mandateEnd?.toISOString() ?? null,
    partyLabel: e.partyLabel,
    source: e.source,
    externalId: e.externalId,
  };
}

// ─── Private query ───────────────────────────────────────────────

const VALID_ROLES = new Set(Object.values(LocalOfficialRole));

async function queryElus(opts: {
  search?: string;
  departmentCode?: string;
  communeId?: string;
  role?: LocalOfficialRole;
  partyId?: string;
  gender?: string;
  currentOnly?: boolean;
  page: number;
  limit: number;
}) {
  const {
    search,
    departmentCode,
    communeId,
    role,
    partyId,
    gender,
    currentOnly = true,
    page,
    limit,
  } = opts;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];

  if (currentOnly) conditions.push({ isCurrent: true });
  if (role && VALID_ROLES.has(role)) conditions.push({ role });
  if (departmentCode) conditions.push({ departmentCode });
  if (communeId) conditions.push({ communeId });
  if (partyId) conditions.push({ partyId });
  if (gender) conditions.push({ gender });

  if (search) {
    conditions.push({
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const [elus, total] = await Promise.all([
    db.localOfficial.findMany({
      where,
      include: {
        commune: { select: COMMUNE_SELECT },
        party: { select: PARTY_SELECT },
        politician: { select: POLITICIAN_SELECT },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: limit,
    }),
    db.localOfficial.count({ where }),
  ]);

  return { data: elus.map(toSummary), total, page, limit };
}

// ─── Cached path (bounded key space) ─────────────────────────────

export async function getElusFiltered(opts: {
  departmentCode?: string;
  communeId?: string;
  role?: LocalOfficialRole;
  partyId?: string;
  gender?: string;
  page: number;
  limit: number;
}) {
  "use cache";
  cacheTag("elections", "maires-listing");
  cacheLife("minutes");
  return queryElus(opts);
}

// ─── Uncached path (free-text search) ────────────────────────────

export async function searchElus(opts: {
  search: string;
  departmentCode?: string;
  communeId?: string;
  role?: LocalOfficialRole;
  partyId?: string;
  gender?: string;
  page: number;
  limit: number;
}) {
  return queryElus(opts);
}

// ─── Router ──────────────────────────────────────────────────────

export async function getElus(opts: {
  search?: string;
  departmentCode?: string;
  communeId?: string;
  role?: LocalOfficialRole;
  partyId?: string;
  gender?: string;
  page: number;
  limit: number;
}) {
  if (opts.search) {
    return searchElus({ ...opts, search: opts.search });
  }
  return getElusFiltered(opts);
}

// ─── Single elu by ID ────────────────────────────────────────────

export async function getEluById(id: string) {
  "use cache";
  cacheTag("elections");
  cacheLife("minutes");

  const elu = await db.localOfficial.findUnique({
    where: { id },
    include: {
      commune: { select: COMMUNE_SELECT },
      party: { select: PARTY_SELECT },
      politician: { select: POLITICIAN_SELECT },
    },
  });

  return elu ? toDetail(elu) : null;
}

// ─── Commune: info + elected officials ───────────────────────────

export async function getCommuneWithElus(inseeCode: string) {
  "use cache";
  cacheTag("elections");
  cacheLife("minutes");

  const commune = await db.commune.findUnique({
    where: { id: inseeCode },
    select: {
      id: true,
      name: true,
      departmentCode: true,
      departmentName: true,
      regionCode: true,
      regionName: true,
      postalCodes: true,
      population: true,
      latitude: true,
      longitude: true,
      totalSeats: true,
      website: true,
    },
  });

  if (!commune) return null;

  const officials = await db.localOfficial.findMany({
    where: { communeId: inseeCode, isCurrent: true },
    include: {
      party: { select: PARTY_SELECT },
      politician: { select: POLITICIAN_SELECT },
    },
    orderBy: [{ role: "asc" }, { lastName: "asc" }],
  });

  const maire = officials.find((o) => o.role === "MAIRE");

  return {
    commune: {
      inseeCode: commune.id,
      name: commune.name,
      departmentCode: commune.departmentCode,
      departmentName: commune.departmentName,
      regionCode: commune.regionCode,
      regionName: commune.regionName,
      postalCodes: commune.postalCodes,
      population: commune.population,
      latitude: commune.latitude,
      longitude: commune.longitude,
      totalSeats: commune.totalSeats,
      website: commune.website,
    },
    maire: maire ? toSummary(maire as RawElu) : null,
    officials: officials.map((o) => toSummary(o as RawElu)),
  };
}
