import Link from "next/link";
import type { WeeklyRecapData } from "@/lib/data/recap";

interface ActivityFeedProps {
  recap: WeeklyRecapData | null;
}

export function ActivityFeed({ recap }: ActivityFeedProps) {
  if (!recap) return null;

  const items: Array<{ label: string; count: number; href: string; color: string }> = [];

  if (recap.votes && recap.votes.total > 0) {
    items.push({
      label: `${recap.votes.total} votes cette semaine`,
      count: recap.votes.total,
      href: "/votes",
      color: "bg-blue-500",
    });
  }

  if (recap.affairs && recap.affairs.newAffairs.length > 0) {
    items.push({
      label: `${recap.affairs.newAffairs.length} nouvelles affaires`,
      count: recap.affairs.newAffairs.length,
      href: "/affaires",
      color: "bg-red-500",
    });
  }

  if (recap.factChecks && recap.factChecks.total > 0) {
    items.push({
      label: `${recap.factChecks.total} fact-checks`,
      count: recap.factChecks.total,
      href: "/factchecks",
      color: "bg-amber-500",
    });
  }

  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-display font-bold mb-4">Activité récente</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-sm hover:border-primary/20 transition-all"
          >
            <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
            <span className="text-sm font-medium flex-1">{item.label}</span>
            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
              Voir &rarr;
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
