import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ElectionCountdown } from "@/components/elections";
import { formatDate } from "@/lib/utils";
import {
  ELECTION_TYPE_ICONS,
  ELECTION_TYPE_LABELS,
  ELECTION_STATUS_LABELS,
  ELECTION_STATUS_COLORS,
} from "@/config/labels";
import type { Election } from "@/types";

interface UpcomingElectionsProps {
  elections: Election[];
  showCountdown?: boolean;
}

export function UpcomingElections({ elections, showCountdown = false }: UpcomingElectionsProps) {
  if (elections.length === 0) return null;

  const [nextElection, ...otherElections] = elections;
  const allElections = showCountdown ? otherElections : elections;

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Prochaines élections</h2>
            <p className="text-muted-foreground">Calendrier des scrutins à venir</p>
          </div>
          <Button variant="ghost" asChild className="text-primary">
            <Link href="/elections">Voir tout &rarr;</Link>
          </Button>
        </div>

        {/* Countdown for the next election (feature-toggled) */}
        {showCountdown && nextElection!.round1Date && (
          <ElectionCountdown
            targetDate={nextElection!.round1Date.toISOString()}
            electionTitle={nextElection!.title}
            electionIcon={ELECTION_TYPE_ICONS[nextElection!.type]}
            dateConfirmed={nextElection!.dateConfirmed}
          />
        )}

        {/* Election cards */}
        {allElections.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allElections.map((election) => (
              <Link key={election.id} href={`/elections/${election.slug}`} className="block">
                <Card className="h-full hover:shadow-lg transition-all hover:border-primary/20">
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl" aria-hidden="true">
                        {ELECTION_TYPE_ICONS[election.type]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">
                          {election.shortTitle || ELECTION_TYPE_LABELS[election.type]}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge
                            className={`text-[10px] ${ELECTION_STATUS_COLORS[election.status]}`}
                          >
                            {ELECTION_STATUS_LABELS[election.status]}
                          </Badge>
                          {election.totalSeats && (
                            <span className="text-xs text-muted-foreground">
                              {election.totalSeats} sièges
                            </span>
                          )}
                        </div>
                        {election.round1Date ? (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {formatDate(election.round1Date)}
                            {!election.dateConfirmed && (
                              <span className="italic"> (provisoire)</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic mt-1.5">
                            Dates à confirmer
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
