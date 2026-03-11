import { db } from "@/lib/db";
import { wikidataService, WIKIDATA_PROPS } from "@/lib/api/wikidata";
import { DataSource, MandateType, PublicationStatus } from "@/generated/prisma";
import { generateSlug } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Pure function: Wikidata candidate selection
// ---------------------------------------------------------------------------

const BIRTHDATE_TOLERANCE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export interface WikidataCandidate {
  id: string;
  label: string;
  isFrench: boolean;
  isPolitician: boolean;
  birthDate: Date | null;
  hasMairePosition: boolean;
}

export function selectBestWikidataCandidate(
  candidates: WikidataCandidate[],
  official: { birthDate: Date | null }
): WikidataCandidate | null {
  const valid = candidates.filter((c) => c.isFrench && c.isPolitician);
  if (valid.length === 0) return null;

  const scored = valid.map((c) => {
    let score = 0;
    if (c.hasMairePosition) score += 2;
    if (c.birthDate && official.birthDate) {
      const diff = Math.abs(c.birthDate.getTime() - official.birthDate.getTime());
      if (diff <= BIRTHDATE_TOLERANCE_MS) score += 3;
    }
    return { candidate: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.candidate ?? null;
}

// ---------------------------------------------------------------------------
// Main promotion service
// ---------------------------------------------------------------------------

export interface PromoteResult {
  politicianId: string;
  slug: string;
  wikidataId: string | null;
}

export async function promoteMayor(
  localOfficialId: string,
  options?: { wikidataId?: string }
): Promise<PromoteResult> {
  // 1. Load LocalOfficial + Commune
  const official = await db.localOfficial.findUnique({
    where: { id: localOfficialId },
    include: { commune: true, party: true },
  });

  if (!official) throw new Error("LocalOfficial non trouve");
  if (official.role !== "MAIRE") throw new Error("Seuls les maires peuvent etre promus");
  if (official.politicianId) throw new Error("Ce maire a deja une fiche Politician");

  // 2. Wikidata resolution
  let wikidataId = options?.wikidataId ?? null;

  if (!wikidataId) {
    const searchResults = await wikidataService.searchByName(official.fullName, { limit: 5 });

    if (searchResults.length > 0) {
      const candidateIds = searchResults.map((r) => r.id);
      const [details, positions] = await Promise.all([
        wikidataService.checkFrenchPoliticians(candidateIds),
        wikidataService.getPositions(candidateIds),
      ]);

      const candidates: WikidataCandidate[] = searchResults.map((r) => {
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

      const best = selectBestWikidataCandidate(candidates, {
        birthDate: official.birthDate,
      });
      if (best) wikidataId = best.id;
    }
  }

  // 3. Fetch Wikidata enrichment (photo via P18)
  let wdBirthDate: Date | null = null;
  let wdPhotoUrl: string | null = null;

  if (wikidataId) {
    const lifeDates = await wikidataService.getLifeDates([wikidataId]);
    wdBirthDate = lifeDates.get(wikidataId)?.birthDate ?? null;

    const entities = await wikidataService.getEntities([wikidataId]);
    const entity = entities.get(wikidataId);
    const imageClaim = entity?.claims?.[WIKIDATA_PROPS.IMAGE]?.[0];
    if (imageClaim?.mainsnak?.datavalue?.value) {
      const filename = String(imageClaim.mainsnak.datavalue.value);
      const encoded = encodeURIComponent(filename.replace(/ /g, "_"));
      wdPhotoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=400`;
    }
  }

  // 4. Create Politician
  const slug = generateSlug(official.fullName);

  const politician = await db.politician.create({
    data: {
      slug,
      civility: official.gender === "F" ? "Mme" : "M.",
      firstName: official.firstName,
      lastName: official.lastName,
      fullName: official.fullName,
      birthDate: wdBirthDate ?? official.birthDate,
      photoUrl: wdPhotoUrl ?? official.photoUrl,
      photoSource: wdPhotoUrl ? "wikidata" : official.photoUrl ? "rne" : null,
      currentPartyId: official.partyId,
      publicationStatus: PublicationStatus.DRAFT,
    },
  });

  // 5. Create ExternalIds
  const externalIdsToCreate = [];
  if (wikidataId) {
    externalIdsToCreate.push({
      politicianId: politician.id,
      source: DataSource.WIKIDATA,
      externalId: wikidataId,
      url: `https://www.wikidata.org/wiki/${wikidataId}`,
    });
  }
  if (official.externalId) {
    externalIdsToCreate.push({
      politicianId: politician.id,
      source: DataSource.RNE,
      externalId: official.externalId,
    });
  }
  if (externalIdsToCreate.length > 0) {
    await db.externalId.createMany({ data: externalIdsToCreate });
  }

  // 6. Link LocalOfficial -> Politician
  await db.localOfficial.update({
    where: { id: localOfficialId },
    data: { politicianId: politician.id },
  });

  // 7. Create MAIRE Mandate
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

  return { politicianId: politician.id, slug, wikidataId };
}
