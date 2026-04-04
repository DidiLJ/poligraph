import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import type { HomepageKPIs } from "@/lib/data/homepage";

interface KPICardProps {
  count: number;
  label: string;
  href?: string;
  color: string;
  badge?: string;
}

function KPICard({ count, label, href, color, badge }: KPICardProps) {
  const content = (
    <Card
      className={`relative border-l-4 transition-all ${
        href ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
      }`}
      style={{ borderLeftColor: color }}
    >
      <CardContent className="p-4">
        {href && (
          <ArrowRight
            className="absolute top-3 right-3 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <div className="text-2xl md:text-3xl font-display font-extrabold tracking-tight">
          {count.toLocaleString("fr-FR")}
        </div>
        <div className="text-sm font-medium mt-1 leading-tight flex items-center gap-2">
          {label}
          {badge && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {badge}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} prefetch={false}>
        {content}
      </Link>
    );
  }
  return content;
}

export function KPIStrip({ kpis }: { kpis: HomepageKPIs }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard
        count={kpis.politiciansCount}
        label="Politiques suivis"
        href="/politiques"
        color="#002654"
      />
      <KPICard
        count={kpis.condamnationsCount}
        label="Condamnations"
        href="/affaires?certainty=ETABLI"
        color="#DC2626"
        badge={
          kpis.proceduresEnCoursCount > 0 ? `${kpis.proceduresEnCoursCount} en cours` : undefined
        }
      />
      <KPICard
        count={kpis.votesCount}
        label="Votes analysés"
        href="/parlement/votes"
        color="#002654"
      />
      <KPICard
        count={kpis.factchecksCount}
        label="Fact-checks vérifiés"
        href="/factchecks"
        color="#6B7280"
      />
    </div>
  );
}
