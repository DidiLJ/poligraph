import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { withCache } from "@/lib/cache";
import { withPublicRoute } from "@/lib/api/with-public-route";

type CommuneRow = {
  id: string;
  name: string;
  departmentCode: string;
  departmentName: string;
  population: number | null;
  totalSeats: number | null;
};

type CandidacyStats = {
  communeId: string;
  listCount: number;
  candidateCount: number;
};

type CommuneResult = CommuneRow & {
  listCount: number;
  candidateCount: number;
};

async function getElectionId(): Promise<string | null> {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2014" },
    select: { id: true },
  });
  return election?.id ?? null;
}

async function getCandidacyStats(
  communeIds: string[],
  electionId: string
): Promise<Map<string, { listCount: number; candidateCount: number }>> {
  if (communeIds.length === 0) return new Map();

  // 2014 has one candidacy per list, so count = listCount = candidateCount
  const stats = await db.$queryRaw<CandidacyStats[]>(Prisma.sql`
    SELECT c."communeId",
           COUNT(*)::int as "listCount",
           COUNT(*)::int as "candidateCount"
    FROM "Candidacy" c
    WHERE c."communeId" = ANY(${communeIds}::text[])
      AND c."electionId" = ${electionId}
    GROUP BY c."communeId"
  `);

  const map = new Map<string, { listCount: number; candidateCount: number }>();
  for (const row of stats) {
    map.set(row.communeId, {
      listCount: row.listCount,
      candidateCount: row.candidateCount,
    });
  }
  return map;
}

function formatResults(
  communes: CommuneRow[],
  statsMap: Map<string, { listCount: number; candidateCount: number }>
): CommuneResult[] {
  return communes.map((c) => {
    const stats = statsMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      departmentCode: c.departmentCode,
      departmentName: c.departmentName,
      population: c.population,
      totalSeats: c.totalSeats,
      listCount: stats?.listCount ?? 0,
      candidateCount: stats?.candidateCount ?? 0,
    };
  });
}

export const GET = withPublicRoute(async (request) => {
  const electionId = await getElectionId();
  if (!electionId) {
    return NextResponse.json({ error: "Élection municipales-2014 introuvable" }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const dept = searchParams.get("dept");

  if (query !== null) {
    return handleTextSearch(query, electionId);
  }

  if (lat !== null && lon !== null) {
    return handleGeolocation(lat, lon, electionId);
  }

  if (dept !== null) {
    return handleDepartmentFilter(dept, electionId);
  }

  return NextResponse.json({ error: "Paramètre requis : q, lat+lon, ou dept" }, { status: 400 });
});

async function handleTextSearch(query: string, electionId: string): Promise<Response> {
  if (query.length < 2) {
    return NextResponse.json([]);
  }

  const isPostalCode = /^\d{2,5}$/.test(query);

  let communes: CommuneRow[];

  if (isPostalCode) {
    if (query.length === 5) {
      communes = await db.commune.findMany({
        where: { postalCodes: { has: query } },
        select: {
          id: true,
          name: true,
          departmentCode: true,
          departmentName: true,
          population: true,
          totalSeats: true,
        },
        orderBy: { population: "desc" },
        take: 8,
      });
    } else if (query.length <= 3) {
      communes = await db.commune.findMany({
        where: { departmentCode: query },
        select: {
          id: true,
          name: true,
          departmentCode: true,
          departmentName: true,
          population: true,
          totalSeats: true,
        },
        orderBy: { population: "desc" },
        take: 8,
      });
    } else {
      communes = await db.commune.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        select: {
          id: true,
          name: true,
          departmentCode: true,
          departmentName: true,
          population: true,
          totalSeats: true,
        },
        orderBy: { population: "desc" },
        take: 8,
      });
    }
  } else {
    communes = await db.commune.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        departmentCode: true,
        departmentName: true,
        population: true,
        totalSeats: true,
      },
      orderBy: { population: "desc" },
      take: 8,
    });
  }

  const communeIds = communes.map((c) => c.id);
  const statsMap = await getCandidacyStats(communeIds, electionId);

  return NextResponse.json(formatResults(communes, statsMap));
}

async function handleGeolocation(
  latStr: string,
  lonStr: string,
  electionId: string
): Promise<Response> {
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json(
      { error: "lat et lon doivent être des nombres valides" },
      { status: 400 }
    );
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "Coordonnées hors limites" }, { status: 400 });
  }

  try {
    const geoRes = await fetch(`https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&limit=1`, {
      next: { revalidate: 86400 },
    });

    if (!geoRes.ok) {
      return NextResponse.json({ error: "Erreur lors de la géolocalisation" }, { status: 502 });
    }

    const geoData = (await geoRes.json()) as Array<{ code: string }>;

    if (geoData.length === 0) {
      return NextResponse.json([]);
    }

    const inseeCode = geoData[0]!.code;

    const commune = await db.commune.findUnique({
      where: { id: inseeCode },
      select: {
        id: true,
        name: true,
        departmentCode: true,
        departmentName: true,
        population: true,
        totalSeats: true,
      },
    });

    if (!commune) {
      return NextResponse.json([]);
    }

    const statsMap = await getCandidacyStats([commune.id], electionId);
    return NextResponse.json(formatResults([commune], statsMap));
  } catch {
    return NextResponse.json({ error: "Erreur lors de la géolocalisation" }, { status: 502 });
  }
}

async function handleDepartmentFilter(dept: string, electionId: string): Promise<Response> {
  if (!/^[0-9]{1,3}[AB]?$/i.test(dept)) {
    return NextResponse.json({ error: "Code département invalide" }, { status: 400 });
  }

  const deptCode = dept.toUpperCase();

  const communes = await db.commune.findMany({
    where: { departmentCode: deptCode },
    select: {
      id: true,
      name: true,
      departmentCode: true,
      departmentName: true,
      population: true,
      totalSeats: true,
    },
    orderBy: { population: "desc" },
    take: 100,
  });

  const communeIds = communes.map((c) => c.id);
  const statsMap = await getCandidacyStats(communeIds, electionId);

  return withCache(NextResponse.json(formatResults(communes, statsMap)), "daily");
}
