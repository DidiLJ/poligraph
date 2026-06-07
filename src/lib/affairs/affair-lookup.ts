import type { Prisma } from "@/generated/prisma";
import type { PublicationStatus } from "@/generated/prisma";

/**
 * Les trois clauses de résolution publique d'une affaire : slug canonique,
 * ancien slug (redirection 301), puis id (CUID).
 *
 * Chaque clause DOIT contenir publicationStatus PUBLISHED : aucune affaire
 * DRAFT, ARCHIVED, EXCLUDED ou REJECTED ne doit être résolue par aucune voie,
 * y compris par id (RGPD article 10, invariant I7).
 */
interface LinkedAffairLike {
  publicationStatus: PublicationStatus;
}

/**
 * Sélectionne l'affaire liée à afficher publiquement.
 *
 * Prisma ne permet pas de filtrer une relation to-one (`linkedAffair`) par
 * un `where` imbriqué dans un `select` : le filtre publicationStatus doit
 * donc être appliqué ici. Aucune affaire liée non publiée ne doit être
 * rendue (titre, slug), même depuis la page d'une affaire publiée (RGPD
 * article 10, invariant I7).
 */
export function pickPublicLinkedAffair<T extends LinkedAffairLike>(
  linkedAffair: T | null | undefined,
  linkedBy: T[] | null | undefined
): T | null {
  if (linkedAffair && linkedAffair.publicationStatus === "PUBLISHED") return linkedAffair;
  return linkedBy?.find((a) => a.publicationStatus === "PUBLISHED") ?? null;
}

export function buildPublicAffairLookupWheres(
  slugOrId: string
): [Prisma.AffairWhereInput, Prisma.AffairWhereInput, Prisma.AffairWhereInput] {
  return [
    { slug: slugOrId, publicationStatus: "PUBLISHED" },
    { oldSlugs: { has: slugOrId }, publicationStatus: "PUBLISHED" },
    { id: slugOrId, publicationStatus: "PUBLISHED" },
  ];
}
