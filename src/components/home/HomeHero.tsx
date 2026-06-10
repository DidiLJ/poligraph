import Link from "next/link";
import { BarChart3, Scale, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeHeroSearch } from "./HomeHeroSearch";

export function HomeHero() {
  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-2xl font-display font-bold tracking-tight md:text-4xl">
          Comprendre la vie politique française par les faits
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Poligraph vous aide à explorer les représentants politiques, leurs votes, les affaires
          judiciaires documentées, les fact-checks et les données publiques.
        </p>
      </div>

      <div className="max-w-xl">
        <HomeHeroSearch />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild size="lg" className="h-11 justify-start sm:justify-center">
          <Link href="/statistiques">
            <BarChart3 aria-hidden="true" />
            Voir les statistiques
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-11 justify-start sm:justify-center"
        >
          <Link href="/affaires">
            <Scale aria-hidden="true" />
            Explorer les affaires documentées
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-11 justify-start sm:justify-center"
        >
          <Link href="/mon-depute">
            <MapPin aria-hidden="true" />
            Trouver mon député
          </Link>
        </Button>
      </div>
    </section>
  );
}
