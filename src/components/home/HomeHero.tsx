import { HomeHeroSearch } from "./HomeHeroSearch";

export function HomeHero() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-display font-bold tracking-tight md:text-4xl">
        Poligraph, l{"'"}observatoire citoyen de la vie politique française
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Poligraph rassemble les données publiques sur les responsables politiques français : leurs
        votes au Parlement, leurs mandats, leur patrimoine déclaré, les affaires judiciaires
        documentées et les fact-checks. Chaque information renvoie à sa source officielle.
      </p>
      <div className="max-w-xl">
        <HomeHeroSearch />
      </div>
    </section>
  );
}
