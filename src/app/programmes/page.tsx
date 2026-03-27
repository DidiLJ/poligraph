import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ComparisonChart } from "@/components/programmes/ComparisonChart";
import { getLatestPlatformsPerParty } from "@/lib/data/platforms";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { ThematicAxis } from "@/generated/prisma";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Programmes des partis",
  description:
    "Comparez les positions des partis politiques français sur les grands axes thématiques : économie, société, écologie, sécurité, institutions.",
  alternates: { canonical: "/programmes" },
};

export default async function ProgrammesPage() {
  if (!(await isFeatureEnabled("PROGRAMMES_ENABLED"))) notFound();

  const platforms = await getLatestPlatformsPerParty();

  // Build comparison data
  const comparisonParties = platforms
    .filter((p) => p.party && p.proposals.length > 0)
    .map((p) => ({
      partySlug: p.party!.slug!,
      partyName: p.party!.name,
      partyShortName: p.party!.shortName,
      partyColor: p.party!.color || "#6b7280",
      positions: Object.fromEntries(p.proposals.map((pr) => [pr.axis, pr.position])) as Partial<
        Record<ThematicAxis, number>
      >,
    }));

  return (
    <div className="container mx-auto px-4 pt-4 pb-8">
      <Breadcrumb items={[{ label: "Programmes" }]} />

      <div className="mt-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Programmes des partis</h1>
          <p className="text-muted-foreground mt-1">
            Comparez les positions des partis politiques sur les grands enjeux
          </p>
        </div>

        {/* Info box */}
        <div className="flex gap-3 rounded-lg border bg-muted/30 p-4">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Les positions affichées sont issues des derniers programmes officiels publiés par chaque
            parti. Pour la plupart, il s{"'"}agit des législatives de 2024. Ces positions sont mises
            à jour lors de chaque nouvelle élection.{" "}
            <Link href="/sources" className="text-primary hover:underline">
              En savoir plus
            </Link>
          </p>
        </div>

        {platforms.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucun programme enregistré pour le moment.</p>
          </div>
        ) : (
          <>
            {/* Multi-party comparison chart */}
            {comparisonParties.length >= 2 && (
              <section aria-labelledby="comparison-heading">
                <h2 id="comparison-heading" className="text-lg font-semibold mb-4">
                  Comparaison par axe
                </h2>
                <ComparisonChart parties={comparisonParties} className="max-w-3xl" />
              </section>
            )}

            {/* Party cards grid */}
            <section aria-labelledby="parties-heading">
              <h2 id="parties-heading" className="text-lg font-semibold mb-4">
                Tous les programmes
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {platforms.map((p) => (
                  <Link
                    key={p.id}
                    href={`/partis/${p.party?.slug}/programme`}
                    className="flex items-center gap-3 border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    prefetch={false}
                  >
                    {p.party?.logoUrl && (
                      <Image
                        src={p.party.logoUrl}
                        alt={p.party.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium">{p.party?.name ?? "Parti inconnu"}</p>
                      <p className="text-xs text-muted-foreground">
                        {p._count.proposals} axe{p._count.proposals > 1 ? "s" : ""} documenté
                        {p._count.proposals > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.election.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
