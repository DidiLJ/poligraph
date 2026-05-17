import { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getSlappAffairs, getSlappStats } from "@/lib/data/slapp";
import { SLAPP_DIRECTIVE_EU } from "@/config/slapp";
import { SlappStatsChart } from "@/components/slapp/SlappStatsChart";

export const metadata: Metadata = {
  title: "Procédures-bâillons en France",
  description:
    "Catalogue documenté des procédures-bâillons (SLAPP) visant les voix critiques en France. Cas qualifiés selon des critères éditoriaux objectifs et sourcés.",
  alternates: { canonical: "/procedures-baillons" },
};

export const revalidate = 300;

export default async function ProceduresBaillonsPage() {
  const [affairs, stats] = await Promise.all([getSlappAffairs({ limit: 100 }), getSlappStats()]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <ShieldAlert className="h-7 w-7 text-amber-700" aria-hidden="true" />
          <h1 className="text-3xl font-display font-extrabold tracking-tight">
            Procédures-bâillons en France
          </h1>
        </div>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Les procédures-bâillons (SLAPP, Strategic Lawsuit Against Public Participation) sont des
          actions en justice manifestement infondées ou disproportionnées, intentées pour faire
          taire les voix critiques : journalistes, lanceurs d&apos;alerte, militants, citoyens. La{" "}
          <a
            href={SLAPP_DIRECTIVE_EU.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {SLAPP_DIRECTIVE_EU.shortName} {SLAPP_DIRECTIVE_EU.identifier}
            <span className="sr-only"> (ouvre un nouvel onglet)</span>
          </a>{" "}
          impose désormais aux États membres des mesures de protection.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Comment nous qualifions un cas</h2>
        <Card>
          <CardContent className="pt-6 prose prose-sm max-w-none">
            <p>
              Une affaire n&apos;est étiquetée procédure-bâillon que si{" "}
              <strong>au moins 3 critères sur 5 sont vérifiés et sourcés</strong>, ou si le critère
              de qualification externe par tiers identifié (RSF, Article 19, CASE Coalition,
              décision judiciaire motivée article 32-1 CPC) est rempli seul.
            </p>
            <p>
              Nous n&apos;inventons pas la qualification : nous agrégeons des cas déjà qualifiés par
              des tiers identifiés. Si aucune source externe ne qualifie le cas, nous le laissons en
              affaire classique avec ses métadonnées habituelles.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">État du catalogue</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Cas documentés</p>
              <p className="text-4xl font-bold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-3">Répartition par issue</p>
              <SlappStatsChart byStatus={stats.byStatus} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Cas répertoriés</h2>
        {affairs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Aucun cas publié pour le moment. Le catalogue est en cours de constitution.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {affairs.map((affair) => (
              <li key={affair.id}>
                <Card>
                  <CardContent className="pt-6">
                    <Link
                      href={`/affaires/${affair.slug}`}
                      className="block hover:text-primary transition-colors"
                    >
                      <h3 className="font-semibold">{affair.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {affair.politician.firstName} {affair.politician.lastName}
                      </p>
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
