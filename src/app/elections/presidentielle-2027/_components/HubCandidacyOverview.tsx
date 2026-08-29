import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import type { HubCandidacy } from "@/lib/data/hub";
import {
  CANDIDACY_FILTERS,
  CANDIDACY_FILTER_LABELS,
  matchesCandidacyFilter,
  matchesPublishedProposals,
} from "@/lib/presidentielle/candidacy-filters";
import { CandidacyStatusBadge } from "./CandidacyStatusBadge";

function publishedContentLabel(candidacy: HubCandidacy): string {
  if (candidacy.measureCount > 0) {
    return `${candidacy.measureCount} ${
      candidacy.measureCount === 1 ? "mesure publiée" : "mesures publiées"
    }`;
  }
  return candidacy.programmeAbsence === "non_depouille"
    ? "Programme non dépouillé"
    : "Aucun programme identifié";
}

/**
 * The people followed by Poligraph, directly on the hub rather than reduced to four counters.
 * The same public field powers the directory, so names, statuses and filters cannot drift.
 */
export function HubCandidacyOverview({ candidacies }: { candidacies: HubCandidacy[] }) {
  const total = candidacies.length;
  const filters = [
    ...CANDIDACY_FILTERS.filter((key) => key !== "toutes").map((key) => ({
      key,
      label: CANDIDACY_FILTER_LABELS[key],
      count: candidacies.filter((candidacy) => matchesCandidacyFilter(candidacy, key)).length,
      href: `/elections/presidentielle-2027/candidats?statut=${key}`,
    })),
    {
      key: "publiees" as const,
      label: "Avec des propositions publiées",
      count: candidacies.filter((candidacy) => matchesPublishedProposals(candidacy, true)).length,
      href: "/elections/presidentielle-2027/candidats?propositions=publiees",
    },
  ];

  return (
    <section id="candidatures" aria-labelledby="hub-candidatures" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="space-y-1.5">
          <h2
            id="hub-candidatures"
            className="font-display text-xl font-bold tracking-tight md:text-2xl"
          >
            {total} {total === 1 ? "personnalité suivie" : "personnalités suivies"}
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Poligraph documente des candidatures, ce n&apos;est pas la liste officielle des
            candidats. L&apos;ordre est alphabétique, sans classement.
          </p>
        </div>
        {total > 0 && (
          <Link
            href="/elections/presidentielle-2027/candidats"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {total === 1 ? "La fiche" : `Les ${total} fiches`}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
      </div>

      {total === 0 ? (
        <p className="max-w-3xl text-sm text-muted-foreground">
          Aucune candidature sourcée à ce jour.
        </p>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {candidacies.map((candidacy) => (
              <li key={candidacy.id}>
                <Link
                  href={`/elections/presidentielle-2027/candidats/${candidacy.politicianSlug}`}
                  prefetch={false}
                  className="flex h-full min-h-11 items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary hover:bg-muted/40 active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  <span aria-hidden="true" className="shrink-0">
                    <PoliticianAvatar
                      photoUrl={candidacy.photoUrl}
                      blobPhotoUrl={candidacy.blobPhotoUrl}
                      fullName={candidacy.candidateName}
                      size="sm"
                      className="h-9 w-9"
                    />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block break-words text-sm font-bold leading-tight">
                      {candidacy.candidateName}
                    </span>
                    {candidacy.partyLabel && (
                      <span className="block text-sm font-medium leading-snug text-foreground">
                        {candidacy.partyLabel}
                      </span>
                    )}
                    <span className="flex flex-wrap items-center gap-1.5">
                      <CandidacyStatusBadge status={candidacy.status} />
                      <span className="text-xs leading-snug text-muted-foreground-strong">
                        {publishedContentLabel(candidacy)}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <nav aria-label="Filtrer les personnalités suivies" className="flex flex-wrap gap-2">
            <span className="self-center text-xs text-muted-foreground-strong">
              Filtrer la liste :
            </span>
            {filters
              .filter((filter) => filter.count > 0)
              .map((filter) => (
                <Link
                  key={filter.key}
                  href={filter.href}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-3.5 text-xs font-medium hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {filter.label} · {filter.count}
                </Link>
              ))}
          </nav>
        </>
      )}
    </section>
  );
}
