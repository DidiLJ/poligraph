import Link from "next/link";
import { Suspense } from "react";
import { DateNavigation } from "./DateNavigation";
import { DailyVotesList } from "./DailyVotesList";
import { CollectionPageJsonLd } from "@/components/seo/JsonLd";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getScrutinsByDate, getAdjacentVoteDates } from "@/lib/data/scrutins";
import { SITE_URL } from "@/config/site";
import { formatDateFrUTC } from "@/lib/utils";
import { Vote, ArrowRight } from "lucide-react";

interface DailyVotesPageProps {
  date: string;
  isToday?: boolean;
}

// The `type` tab is read client-side in DailyVotesList (useSearchParams), NOT
// here — accessing searchParams in this server component would opt the whole
// route (and the scrutin-detail [slug] route that renders it) into dynamic
// rendering, defeating ISR. The data fetch returns ALL scrutins regardless of
// tab, so client-side filtering is lossless.
export async function DailyVotesPage({ date, isToday }: DailyVotesPageProps) {
  const [data, adjacent] = await Promise.all([getScrutinsByDate(date), getAdjacentVoteDates(date)]);

  const formatted = formatDateFrUTC(date);
  const title = isToday ? "Votes du jour" : `Votes du ${formatted}`;
  const canonicalPath = isToday ? "/parlement/votes/aujourd-hui" : `/parlement/votes/${date}`;

  return (
    <>
      {data.total > 0 && (
        <CollectionPageJsonLd
          name={`Votes parlementaires du ${formatted}`}
          description={`${data.total} scrutins de l'Assemblée nationale et du Sénat du ${formatted}`}
          url={`${SITE_URL}${canonicalPath}`}
          numberOfItems={data.total}
        />
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Breadcrumb
            items={[
              { label: "Parlement", href: "/parlement" },
              { label: "Votes", href: "/parlement/votes" },
              { label: isToday ? "Aujourd'hui" : formatted },
            ]}
          />

          <h1 className="text-3xl font-display font-extrabold tracking-tight mb-4">{title}</h1>

          <DateNavigation
            prevDate={adjacent.prevDate}
            nextDate={adjacent.nextDate}
            currentDate={date}
            isToday={isToday}
          />
        </div>

        {data.total > 0 ? (
          <Suspense fallback={null}>
            <DailyVotesList scrutins={data.scrutins} canonicalPath={canonicalPath} />
          </Suspense>
        ) : (
          <EmptyState prevDate={adjacent.prevDate} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({ prevDate }: { prevDate: string | null }) {
  return (
    <div className="text-center py-20">
      <Vote className="h-10 w-10 mx-auto mb-4 text-muted-foreground/30" aria-hidden="true" />
      <p className="text-lg font-medium text-muted-foreground mb-2">Aucun scrutin ce jour</p>
      <p className="text-sm text-muted-foreground/60 mb-6">
        Le Parlement ne siège pas tous les jours (weekends, vacances, recesses).
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {prevDate && (
          <Link
            href={`/parlement/votes/${prevDate}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:underline"
            prefetch={false}
          >
            Derniers votes ({formatDateFrUTC(prevDate)})
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
        <Link
          href="/parlement/votes"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          prefetch={false}
        >
          Voir tous les votes
        </Link>
      </div>
    </div>
  );
}
