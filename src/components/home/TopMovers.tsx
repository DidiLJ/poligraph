import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { ChevronRight } from "lucide-react";
import type { TopMoverItem } from "@/lib/data/top-movers";

const TYPE_COLORS: Record<TopMoverItem["type"], string> = {
  affair: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  factcheck: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  mandate: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  election: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  party: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const TYPE_LABELS: Record<TopMoverItem["type"], string> = {
  affair: "Affaire",
  factcheck: "Fact-check",
  mandate: "Mandat",
  election: "Élection",
  party: "Parti",
};

export function TopMovers({ movers }: { movers: TopMoverItem[] }) {
  if (movers.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-display font-bold mb-4">Qui fait l{"'"}actu</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {movers.map((mover) => (
          <Link key={mover.politician.slug} href={mover.href} prefetch={false}>
            <Card className="group cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all h-full">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PoliticianAvatar
                      photoUrl={mover.politician.photoUrl}
                      firstName={mover.politician.firstName}
                      lastName={mover.politician.lastName}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm leading-tight">
                        {mover.politician.firstName} {mover.politician.lastName}
                      </div>
                      {mover.politician.currentParty && (
                        <div className="text-xs text-muted-foreground">
                          {mover.politician.currentParty.shortName}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_COLORS[mover.type]}`}
                  >
                    {TYPE_LABELS[mover.type]}
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight">
                    {mover.reason}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
