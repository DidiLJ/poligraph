import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { type LucideIcon, Vote, FileText, Users, ArrowRight } from "lucide-react";

interface HubEntry {
  href: string;
  title: string;
  description: string;
  cta: string;
  Icon: LucideIcon;
}

// Orientation shortcuts to the three parliament pillars. Static copy; links only
// point to existing routes (votes, dossiers, groupes).
const HUB_ENTRIES: HubEntry[] = [
  {
    href: ROUTES.votes,
    title: "Scrutins et votes",
    description:
      "Explorer les votes de l'Assemblée nationale et du Sénat, par date, thème ou résultat.",
    cta: "Voir les scrutins",
    Icon: Vote,
  },
  {
    href: ROUTES.dossiers,
    title: "Lois en construction",
    description: "Suivre les textes déposés, discutés, amendés ou adoptés au Parlement.",
    cta: "Voir les dossiers",
    Icon: FileText,
  },
  {
    href: ROUTES.groupes,
    title: "Groupes parlementaires",
    description: "Comprendre la composition des chambres et les équilibres politiques.",
    cta: "Voir les groupes",
    Icon: Users,
  },
];

export function ParlementEntryCards() {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-1">Explorer le Parlement</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Choisissez une entrée selon ce que vous voulez comprendre.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {HUB_ENTRIES.map((entry) => {
          const Icon = entry.Icon;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="group flex flex-col gap-2 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="font-semibold">{entry.title}</span>
              </span>
              <span className="text-sm text-muted-foreground">{entry.description}</span>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                {entry.cta}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
