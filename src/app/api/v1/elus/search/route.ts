import { NextResponse } from "next/server";
import { searchElus } from "@/lib/data/elus";
import { withCache } from "@/lib/cache";
import { withPublicRoute } from "@/lib/api/with-public-route";

/**
 * @openapi
 * /api/v1/elus/search:
 *   get:
 *     summary: Recherche d'élus locaux par nom
 *     description: Recherche rapide par nom. Retourne jusqu'à 20 résultats.
 *     tags: [Élus locaux]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Terme de recherche (min. 2 caractères)
 *     responses:
 *       200:
 *         description: Résultats de la recherche
 *       400:
 *         description: Paramètre q manquant ou trop court
 *       500:
 *         description: Erreur serveur
 */
export const GET = withPublicRoute(async (request) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: "Le paramètre q est requis (min. 2 caractères)" },
      { status: 400 }
    );
  }

  const result = await searchElus({
    search: q,
    page: 1,
    limit: 20,
  });

  return withCache(NextResponse.json({ data: result.data, total: result.total }), "daily");
});
