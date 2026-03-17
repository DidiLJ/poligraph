import { NextResponse } from "next/server";
import { LocalOfficialRole } from "@/generated/prisma";
import { getElus } from "@/lib/data/elus";
import { withCache } from "@/lib/cache";
import { parsePagination, buildPaginationMeta } from "@/lib/api/pagination";
import { withPublicRoute } from "@/lib/api/with-public-route";

const VALID_ROLES = new Set(Object.values(LocalOfficialRole));
const VALID_GENDERS = new Set(["M", "F"]);

/**
 * @openapi
 * /api/v1/elus:
 *   get:
 *     summary: Liste des élus locaux
 *     description: >
 *       Retourne la liste paginée des élus locaux français (maires, adjoints,
 *       conseillers municipaux, départementaux, régionaux).
 *       Filtrable par département, commune, rôle, parti et genre.
 *     tags: [Élus locaux]
 *     parameters:
 *       - in: query
 *         name: departement
 *         schema:
 *           type: string
 *         description: Code département (ex. "93", "2A")
 *       - in: query
 *         name: commune
 *         schema:
 *           type: string
 *         description: Code INSEE de la commune (ex. "75056")
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [MAIRE, ADJOINT_MAIRE, CONSEILLER_MUNICIPAL, PRESIDENT_DEPARTEMENT, VICE_PRESIDENT_DEPARTEMENT, CONSEILLER_DEPARTEMENTAL, PRESIDENT_REGION, VICE_PRESIDENT_REGION, CONSEILLER_REGIONAL]
 *         description: Filtrer par rôle
 *       - in: query
 *         name: partyId
 *         schema:
 *           type: string
 *         description: Filtrer par ID de parti politique
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *           enum: [M, F]
 *         description: Filtrer par genre
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche par nom
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Liste paginée des élus locaux
 *       500:
 *         description: Erreur serveur
 */
export const GET = withPublicRoute(async (request) => {
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || undefined;
  const departmentCode = searchParams.get("departement") || undefined;
  const communeId = searchParams.get("commune") || undefined;
  const partyId = searchParams.get("partyId") || undefined;

  const roleParam = searchParams.get("role");
  const role =
    roleParam && VALID_ROLES.has(roleParam as LocalOfficialRole)
      ? (roleParam as LocalOfficialRole)
      : undefined;

  const genderParam = searchParams.get("gender");
  const gender = genderParam && VALID_GENDERS.has(genderParam) ? genderParam : undefined;

  const { page, limit } = parsePagination(searchParams, { defaultLimit: 50 });

  const result = await getElus({
    search,
    departmentCode,
    communeId,
    role,
    partyId,
    gender,
    page,
    limit,
  });

  return withCache(
    NextResponse.json({
      data: result.data,
      pagination: buildPaginationMeta(result.page, result.limit, result.total),
    }),
    "daily"
  );
});
