import { NextResponse } from "next/server";
import { getCommuneWithElus } from "@/lib/data/elus";
import { withCache } from "@/lib/cache";
import { withPublicRoute } from "@/lib/api/with-public-route";

/**
 * @openapi
 * /api/v1/communes/{codeInsee}:
 *   get:
 *     summary: Informations d'une commune et ses élus
 *     description: >
 *       Retourne les informations de la commune (nom, département, population,
 *       coordonnées) ainsi que la liste de ses élus en exercice (maire, adjoints,
 *       conseillers municipaux).
 *     tags: [Communes]
 *     parameters:
 *       - in: path
 *         name: codeInsee
 *         required: true
 *         schema:
 *           type: string
 *         description: Code INSEE de la commune (ex. "75056")
 *     responses:
 *       200:
 *         description: Commune avec ses élus
 *       404:
 *         description: Commune non trouvée
 *       500:
 *         description: Erreur serveur
 */
export const GET = withPublicRoute(async (request, context) => {
  const params = await context.params;
  const codeInsee = params["codeInsee"]!;

  const result = await getCommuneWithElus(codeInsee);

  if (!result) {
    return NextResponse.json({ error: "Commune non trouvée" }, { status: 404 });
  }

  return withCache(NextResponse.json(result), "daily");
});
