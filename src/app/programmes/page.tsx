import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getPlatformsListing } from "@/lib/data/platforms";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Programmes des partis",
  description:
    "Consultez et comparez les programmes des partis politiques français sur les grands axes thématiques : économie, société, écologie, sécurité, institutions.",
  alternates: { canonical: "/programmes" },
};

export default async function ProgrammesPage() {
  if (!(await isFeatureEnabled("PROGRAMMES_ENABLED"))) notFound();

  const platforms = await getPlatformsListing();

  // Group by election
  const byElection = new Map<string, typeof platforms>();
  for (const p of platforms) {
    const key = p.election.slug;
    const existing = byElection.get(key) ?? [];
    existing.push(p);
    byElection.set(key, existing);
  }

  return (
    <div className="container mx-auto px-4 pt-4 pb-8">
      <Breadcrumb items={[{ label: "Programmes" }]} />

      <div className="mt-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Programmes des partis</h1>
          <p className="text-muted-foreground mt-1">
            Positions des partis politiques sur les grands axes thématiques
          </p>
        </div>

        {platforms.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucun programme enregistré pour le moment.</p>
          </div>
        ) : (
          Array.from(byElection.entries()).map(([electionSlug, electionPlatforms]) => (
            <section key={electionSlug} aria-labelledby={`election-${electionSlug}`}>
              <h2 id={`election-${electionSlug}`} className="text-lg font-semibold mb-4">
                {electionPlatforms[0]?.election.title}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {electionPlatforms.map((p) => (
                  <Link
                    key={p.id}
                    href={`/partis/${p.party?.slug}/programme`}
                    className="block border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    prefetch={false}
                  >
                    <div className="flex items-center gap-3">
                      {p.party?.logoUrl && (
                        <img
                          src={p.party.logoUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium">{p.party?.name ?? "Parti inconnu"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p._count.proposals} proposition{p._count.proposals > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
