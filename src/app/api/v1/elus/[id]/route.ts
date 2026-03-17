import { NextResponse } from "next/server";
import { getEluById } from "@/lib/data/elus";
import { withCache } from "@/lib/cache";
import { withPublicRoute } from "@/lib/api/with-public-route";

/**
 * @openapi
 * /api/v1/elus/{id}:
 *   get:
 *     summary: Détails d'un élu local
 *     description: >
 *       Retourne les informations détaillées d'un élu local, incluant son rôle,
 *       sa commune, ses dates de mandat, et le lien vers sa fiche Poligraph si elle existe.
 *     tags: [Élus locaux]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant de l'élu
 *     responses:
 *       200:
 *         description: Détails de l'élu
 *       404:
 *         description: Élu non trouvé
 *       500:
 *         description: Erreur serveur
 */
export const GET = withPublicRoute(async (request, context) => {
  const params = await context.params;
  const id = params["id"]!;

  const elu = await getEluById(id);

  if (!elu) {
    return NextResponse.json({ error: "Élu non trouvé" }, { status: 404 });
  }

  return withCache(NextResponse.json(elu), "daily");
});
