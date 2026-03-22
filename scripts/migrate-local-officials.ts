/**
 * Migration: LocalOfficial -> Politician + Mandate + MandateLocal
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/migrate-local-officials.ts
 *   npx dotenv -e .env -- npx tsx scripts/migrate-local-officials.ts --dry-run
 *   npx dotenv -e .env -- npx tsx scripts/migrate-local-officials.ts --limit=100
 */
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { generateSlug } from "@/lib/utils";
import { MandateType, DataSource, PublicationStatus } from "@/generated/prisma";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  return arg ? parseInt(arg.split("=")[1] ?? "0") : undefined;
})();
const BATCH_SIZE = 500;

// Map LocalOfficialRole string -> MandateType
const ROLE_TO_MANDATE: Record<string, MandateType> = {
  MAIRE: MandateType.MAIRE,
  ADJOINT_MAIRE: MandateType.ADJOINT_MAIRE,
  CONSEILLER_MUNICIPAL: MandateType.CONSEILLER_MUNICIPAL,
  PRESIDENT_DEPARTEMENT: MandateType.PRESIDENT_DEPARTEMENT,
  VICE_PRESIDENT_DEPARTEMENT: MandateType.VICE_PRESIDENT_DEPARTEMENT,
  CONSEILLER_DEPARTEMENTAL: MandateType.CONSEILLER_DEPARTEMENTAL,
  PRESIDENT_REGION: MandateType.PRESIDENT_REGION,
  VICE_PRESIDENT_REGION: MandateType.VICE_PRESIDENT_REGION,
  CONSEILLER_REGIONAL: MandateType.CONSEILLER_REGIONAL,
};

interface MigrationStats {
  totalOfficials: number;
  alreadyLinked: number;
  politiciansCreated: number;
  mandatesCreated: number;
  mandateLocalsCreated: number;
  skippedDuplicateMandate: number;
  slugCollisions: number;
  errors: string[];
}

async function generateUniqueSlug(fullName: string, usedSlugs: Set<string>): Promise<string> {
  let base = generateSlug(fullName);
  if (!base) base = "inconnu";
  let slug = base;
  let suffix = 2;

  while (usedSlugs.has(slug) || (await db.politician.findUnique({ where: { slug } }))) {
    slug = `${base}-${suffix}`;
    suffix++;
  }

  usedSlugs.add(slug);
  return slug;
}

async function migrate() {
  console.log(`Migration LocalOfficial -> Politician + Mandate + MandateLocal`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);

  const stats: MigrationStats = {
    totalOfficials: 0,
    alreadyLinked: 0,
    politiciansCreated: 0,
    mandatesCreated: 0,
    mandateLocalsCreated: 0,
    skippedDuplicateMandate: 0,
    slugCollisions: 0,
    errors: [],
  };

  // Load all LocalOfficials (raw SQL since Prisma model was removed)
  const officials = await db.$queryRaw<
    {
      id: string;
      role: string;
      firstName: string;
      lastName: string;
      fullName: string;
      gender: string | null;
      birthDate: Date | null;
      communeId: string | null;
      departmentCode: string;
      regionCode: string | null;
      partyLabel: string | null;
      partyId: string | null;
      mandateStart: Date | null;
      functionStart: Date | null;
      mandateEnd: Date | null;
      isCurrent: boolean;
      politicianId: string | null;
      source: string;
      externalId: string | null;
      photoUrl: string | null;
      createdAt: Date;
    }[]
  >`
    SELECT * FROM "LocalOfficial"
    ORDER BY "createdAt" ASC
    ${LIMIT ? Prisma.sql`LIMIT ${LIMIT}` : Prisma.empty}
  `;

  stats.totalOfficials = officials.length;
  console.log(`Found ${officials.length} LocalOfficials to migrate`);

  // Build commune name lookup (since raw SQL doesn't do nested includes)
  const communeIds = [...new Set(officials.map((o) => o.communeId).filter(Boolean))] as string[];
  const communes =
    communeIds.length > 0
      ? await db.commune.findMany({
          where: { id: { in: communeIds } },
          select: { id: true, name: true },
        })
      : [];
  const communeNameMap = new Map(communes.map((c) => [c.id, c.name]));

  const usedSlugs = new Set<string>();

  // Process in batches
  for (let i = 0; i < officials.length; i += BATCH_SIZE) {
    const batch = officials.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(officials.length / BATCH_SIZE)}`
    );

    for (const official of batch) {
      try {
        const mandateType = ROLE_TO_MANDATE[official.role];
        if (!mandateType) {
          stats.errors.push(`Unknown role ${official.role} for ${official.id}`);
          continue;
        }

        let politicianId = official.politicianId;

        // Step 1: Create Politician if not linked
        if (!politicianId) {
          const slug = await generateUniqueSlug(official.fullName, usedSlugs);
          if (slug !== generateSlug(official.fullName)) {
            stats.slugCollisions++;
          }

          if (!DRY_RUN) {
            const politician = await db.politician.create({
              data: {
                slug,
                firstName: official.firstName,
                lastName: official.lastName,
                fullName: official.fullName,
                civility: official.gender === "F" ? "Mme" : "M.",
                birthDate: official.birthDate,
                photoUrl: official.photoUrl,
                currentPartyId: official.partyId,
                source: DataSource.RNE,
                publicationStatus: PublicationStatus.PUBLISHED,
              },
            });
            politicianId = politician.id;
          }
          stats.politiciansCreated++;
        } else {
          stats.alreadyLinked++;
        }

        // Step 2: Check for existing Mandate of same type for same commune
        if (politicianId) {
          const existingMandate = await db.mandate.findFirst({
            where: {
              politicianId,
              type: mandateType,
              ...(official.communeId ? { localData: { communeId: official.communeId } } : {}),
            },
            include: { localData: true },
          });

          if (existingMandate) {
            stats.skippedDuplicateMandate++;

            // Still create MandateLocal if missing
            if (!existingMandate.localData && !DRY_RUN) {
              await db.mandateLocal.create({
                data: {
                  mandateId: existingMandate.id,
                  communeId: official.communeId,
                  functionStart: official.functionStart,
                  regionCode: official.regionCode,
                  rneExternalId: official.externalId,
                  partyLabel: official.partyLabel,
                },
              });
              stats.mandateLocalsCreated++;
            }
            continue;
          }
        }

        // Step 3: Create Mandate + MandateLocal
        if (!DRY_RUN && politicianId) {
          const communeName =
            (official.communeId && communeNameMap.get(official.communeId)) ?? "Commune";
          await db.mandate.create({
            data: {
              politicianId,
              type: mandateType,
              title:
                mandateType === MandateType.MAIRE
                  ? `Maire de ${communeName}`
                  : `${mandateType} - ${communeName}`,
              institution: communeName,
              startDate: official.functionStart ?? official.mandateStart ?? new Date("2020-05-18"),
              endDate: official.mandateEnd,
              isCurrent: official.isCurrent,
              departmentCode: official.departmentCode,
              constituency: official.communeId
                ? `${communeName} (${official.communeId})`
                : communeName,
              source: DataSource.RNE,
              localData: {
                create: {
                  communeId: official.communeId,
                  functionStart: official.functionStart,
                  regionCode: official.regionCode,
                  rneExternalId: official.externalId,
                  partyLabel: official.partyLabel,
                },
              },
            },
          });
          stats.mandatesCreated++;
          stats.mandateLocalsCreated++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        stats.errors.push(`${official.id} (${official.fullName}): ${msg}`);
      }
    }
  }

  // Print results
  console.log("\n=== Migration Results ===");
  console.log(`Total officials:          ${stats.totalOfficials}`);
  console.log(`Already linked:           ${stats.alreadyLinked}`);
  console.log(`Politicians created:      ${stats.politiciansCreated}`);
  console.log(`Mandates created:         ${stats.mandatesCreated}`);
  console.log(`MandateLocals created:    ${stats.mandateLocalsCreated}`);
  console.log(`Duplicate mandates skip:  ${stats.skippedDuplicateMandate}`);
  console.log(`Slug collisions:          ${stats.slugCollisions}`);
  console.log(`Errors:                   ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log("\nErrors:");
    stats.errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
    if (stats.errors.length > 20) {
      console.log(`  ... and ${stats.errors.length - 20} more`);
    }
  }

  // Validation
  if (!DRY_RUN) {
    console.log("\n=== Validation ===");
    const totalPoliticians = await db.politician.count();
    const totalMandates = await db.mandate.count({
      where: { type: { in: Object.values(ROLE_TO_MANDATE) } },
    });
    const totalMandateLocals = await db.mandateLocal.count();
    const unlinkedResult = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "LocalOfficial" WHERE "politicianId" IS NULL
    `;
    const remainingUnlinked = Number(unlinkedResult[0]?.count ?? 0);

    console.log(`Total politicians:        ${totalPoliticians}`);
    console.log(`Local mandates:           ${totalMandates}`);
    console.log(`MandateLocal records:     ${totalMandateLocals}`);
    console.log(`Remaining unlinked:       ${remainingUnlinked}`);

    if (remainingUnlinked > 0) {
      console.log("WARNING: Some LocalOfficials remain unlinked!");
    }

    // Check slug uniqueness
    const slugs = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) - COUNT(DISTINCT slug) as count FROM "Politician"
    `;
    const dupes = Number(slugs[0]?.count ?? 0);
    if (dupes > 0) {
      console.log(`WARNING: ${dupes} duplicate slugs detected!`);
    } else {
      console.log("Slug uniqueness: OK");
    }
  }
}

migrate()
  .catch(console.error)
  .finally(() => db.$disconnect());
