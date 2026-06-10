import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin,
  Vote,
  Scale,
  BarChart3,
  ArrowLeftRight,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface IntentionItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  featureFlag?: string;
}

const ITEMS: IntentionItem[] = [
  {
    href: "/mon-depute",
    label: "Trouver mon député",
    description: "Qui me représente, par code postal",
    icon: MapPin,
    featureFlag: "MON_DEPUTE_SECTION",
  },
  {
    href: "/parlement/votes",
    label: "Voir comment ils ont voté",
    description: "Scrutins et positions des élus",
    icon: Vote,
  },
  {
    href: "/affaires",
    label: "Explorer les affaires",
    description: "Dossiers judiciaires sourcés",
    icon: Scale,
  },
  {
    href: "/statistiques",
    label: "Consulter les statistiques",
    description: "Tableaux de bord et analyses",
    icon: BarChart3,
    featureFlag: "STATISTIQUES_SECTION",
  },
  {
    href: "/comparer",
    label: "Comparer des élus",
    description: "Mandats, votes et activité",
    icon: ArrowLeftRight,
    featureFlag: "COMPARISON_TOOL",
  },
  {
    href: "/elections",
    label: "Suivre les élections",
    description: "Candidats, listes et résultats",
    icon: CalendarDays,
  },
];

interface IntentionGridProps {
  enabledFlags: Set<string>;
}

export function IntentionGrid({ enabledFlags }: IntentionGridProps) {
  const filtered = ITEMS.filter((item) => !item.featureFlag || enabledFlags.has(item.featureFlag));

  return (
    <section>
      <h2 className="mb-4 text-lg font-display font-bold">Que cherchez-vous ?</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} prefetch={false}>
              <Card className="group h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-tight">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                    aria-hidden="true"
                  />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
