import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";

export const BIO_BUCKETS = [
  { label: "Vide", min: 0, max: 0 },
  { label: "Stub (<200 car.)", min: 1, max: 199 },
  { label: "Court (200-799 car.)", min: 200, max: 799 },
  { label: "Rédigée (≥800 car.)", min: 800, max: null },
] as const;

export interface BioBucketRow {
  label: string;
  min: number;
  max: number | null;
  publishedCount: number;
  draftCount: number;
  currentMandateCount: number;
}

export interface BioQualityBreakdown {
  buckets: BioBucketRow[];
  totalPoliticians: number;
  totalWithCurrentMandate: number;
}

interface RawRow {
  bucket: string;
  published: bigint;
  draft: bigint;
  withCurrent: bigint;
}

export async function getBioQualityBreakdown(): Promise<BioQualityBreakdown> {
  const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
    WITH bucketed AS (
      SELECT
        p.id,
        p."publicationStatus",
        CASE
          WHEN p.biography IS NULL OR p.biography = '' THEN 'Vide'
          WHEN char_length(p.biography) < 200 THEN 'Stub (<200 car.)'
          WHEN char_length(p.biography) < 800 THEN 'Court (200-799 car.)'
          ELSE 'Rédigée (≥800 car.)'
        END AS bucket,
        EXISTS (
          SELECT 1 FROM "Mandate" m
          WHERE m."politicianId" = p.id AND m."isCurrent" = true
        ) AS has_current
      FROM "Politician" p
    )
    SELECT
      bucket,
      COUNT(*) FILTER (WHERE "publicationStatus" = 'PUBLISHED')::bigint AS published,
      COUNT(*) FILTER (WHERE "publicationStatus" = 'DRAFT')::bigint AS draft,
      COUNT(*) FILTER (WHERE has_current = true)::bigint AS "withCurrent"
    FROM bucketed
    GROUP BY bucket
  `);

  const totalRow = await db.$queryRaw<Array<{ total: bigint; withCurrent: bigint }>>(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM "Mandate" m WHERE m."politicianId" = p.id AND m."isCurrent" = true)
      )::bigint AS "withCurrent"
    FROM "Politician" p
  `);

  const lookup = new Map(rows.map((r) => [r.bucket, r]));

  const buckets: BioBucketRow[] = BIO_BUCKETS.map((b) => {
    const row = lookup.get(b.label);
    return {
      label: b.label,
      min: b.min,
      max: b.max,
      publishedCount: Number(row?.published ?? BigInt(0)),
      draftCount: Number(row?.draft ?? BigInt(0)),
      currentMandateCount: Number(row?.withCurrent ?? BigInt(0)),
    };
  });

  return {
    buckets,
    totalPoliticians: Number(totalRow[0]?.total ?? BigInt(0)),
    totalWithCurrentMandate: Number(totalRow[0]?.withCurrent ?? BigInt(0)),
  };
}
