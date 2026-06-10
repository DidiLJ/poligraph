import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface PopularLink {
  href: string;
  label: string;
}

const LINKS: PopularLink[] = [
  { href: "/statistiques", label: "Statistiques de la vie politique" },
  { href: "/affaires/condamnations?view=stats", label: "Condamnations par parti (statistiques)" },
  { href: "/affaires", label: "Toutes les affaires judiciaires documentées" },
  { href: "/parlement/votes", label: "Votes à l'Assemblée et au Sénat" },
  { href: "/mon-depute", label: "Trouver mon député" },
];

export function PopularData() {
  return (
    <section>
      <h2 className="mb-4 text-lg font-display font-bold">Données les plus consultées</h2>
      <ul className="divide-y rounded-xl border bg-card">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              prefetch={false}
              className="group flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/40"
            >
              <span className="flex-1 font-medium">{link.label}</span>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
