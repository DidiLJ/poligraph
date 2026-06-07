import type { Prisma } from "@/generated/prisma";

/**
 * Les trois clauses de résolution publique d'une affaire : slug canonique,
 * ancien slug (redirection 301), puis id (CUID).
 *
 * Chaque clause DOIT contenir publicationStatus PUBLISHED : aucune affaire
 * DRAFT, ARCHIVED, EXCLUDED ou REJECTED ne doit être résolue par aucune voie,
 * y compris par id (RGPD article 10, invariant I7).
 */
export function buildPublicAffairLookupWheres(
  slugOrId: string
): [Prisma.AffairWhereInput, Prisma.AffairWhereInput, Prisma.AffairWhereInput] {
  return [
    { slug: slugOrId, publicationStatus: "PUBLISHED" },
    { oldSlugs: { has: slugOrId }, publicationStatus: "PUBLISHED" },
    { id: slugOrId, publicationStatus: "PUBLISHED" },
  ];
}
