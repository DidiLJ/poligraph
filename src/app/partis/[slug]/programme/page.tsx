import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getParty } from "@/lib/data/partis";
import { getPartyPlatform } from "@/lib/data/platforms";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { RadarChart } from "@/components/programmes/RadarChart";
import { PositionChart } from "@/components/programmes/PositionChart";
import { ProposalCard } from "@/components/programmes/ProposalCard";
import { THEMATIC_AXIS_SCOPE, QUIZ_ELECTION_SCOPE_LABELS } from "@/config/labels";
import type { ThematicAxis, QuizElectionScope, Proposal } from "@/generated/prisma";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!(await isFeatureEnabled("PROGRAMMES_ENABLED"))) return {};

  const { slug } = await params;
  const party = await getParty(slug);

  if (!party) return { title: "Parti non trouvé" };

  const title = `Programme de ${party.name} (${party.shortName})`;
  const description = `Découvrez les positions programmatiques de ${party.name} sur les grands axes thématiques : économie, société, écologie, sécurité, institutions.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Poligraph`,
      description,
      type: "article",
    },
    alternates: { canonical: `/partis/${slug}/programme` },
  };
}

export default async function PartyProgrammePage({ params }: PageProps) {
  if (!(await isFeatureEnabled("PROGRAMMES_ENABLED"))) notFound();

  const { slug } = await params;
  const [party, platform] = await Promise.all([getParty(slug), getPartyPlatform(slug)]);

  if (!party) notFound();

  // Group proposals by scope
  const proposalsByScope = new Map<QuizElectionScope, Proposal[]>();
  if (platform) {
    for (const proposal of platform.proposals) {
      const scope = THEMATIC_AXIS_SCOPE[proposal.axis];
      const existing = proposalsByScope.get(scope) ?? [];
      existing.push(proposal);
      proposalsByScope.set(scope, existing);
    }
  }

  // Build positions map for chart
  const positions: Partial<Record<ThematicAxis, number>> = {};
  if (platform) {
    for (const p of platform.proposals) {
      positions[p.axis] = p.position;
    }
  }

  return (
    <div className="container mx-auto px-4 pt-4 pb-8">
      <Breadcrumb
        items={[
          { label: "Partis", href: "/partis" },
          { label: party.shortName || party.name, href: `/partis/${slug}` },
          { label: "Programme" },
        ]}
      />

      <div className="mt-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Programme de {party.name}</h1>
          {platform?.election && (
            <p className="text-muted-foreground mt-1">{platform.election.title}</p>
          )}
          {platform?.sourceUrl && (
            <a
              href={platform.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline mt-2 inline-block"
              aria-label={`Programme source de ${party.name} (ouvre dans un nouvel onglet)`}
            >
              Voir le programme complet
            </a>
          )}
        </div>

        {!platform ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Aucun programme enregistré pour {party.name} pour le moment.
            </p>
          </div>
        ) : (
          <>
            {/* Radar chart */}
            {Object.keys(positions).length >= 3 && (
              <section aria-label="Radar des positions">
                <RadarChart positions={positions} color={party.color || "#3b82f6"} />
              </section>
            )}

            {/* Position scale */}
            {Object.keys(positions).length > 0 && (
              <section aria-label="Détail des positions par axe">
                <h2 className="text-lg font-semibold mb-4">Positionnement par axe</h2>
                <PositionChart
                  positions={positions}
                  color={party.color || "#3b82f6"}
                  className="max-w-2xl"
                />
              </section>
            )}

            {/* Proposals grouped by scope */}
            {(["COMMON", "NATIONAL", "MUNICIPAL"] as const).map((scope) => {
              const proposals = proposalsByScope.get(scope);
              if (!proposals || proposals.length === 0) return null;

              return (
                <section key={scope} aria-labelledby={`scope-${scope}`}>
                  <h2 id={`scope-${scope}`} className="text-lg font-semibold mb-4">
                    {QUIZ_ELECTION_SCOPE_LABELS[scope]}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {proposals.map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        axis={proposal.axis}
                        position={proposal.position}
                        summary={proposal.summary}
                        sourceExcerpt={proposal.sourceExcerpt}
                        sourceUrl={proposal.sourceUrl}
                        aiGenerated={proposal.aiGenerated}
                        verifiedBy={proposal.verifiedBy}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
