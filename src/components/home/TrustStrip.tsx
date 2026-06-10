import Link from "next/link";
import { Database, BookOpen, ArrowRight } from "lucide-react";

export function TrustStrip() {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-display font-bold">D{"'"}où viennent nos données</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Poligraph s{"'"}appuie sur des données publiques ouvertes : Assemblée nationale, Sénat,
        Parlement européen, HATVP et sources de presse vérifiées. Notre méthode et nos principes
        sont documentés et consultables.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/sources"
          className="group inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/40"
        >
          <Database className="h-4 w-4 text-primary" aria-hidden="true" />
          Sources et principes
          <ArrowRight
            className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
        <Link
          href="/methodologie"
          className="group inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/40"
        >
          <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
          Méthodologie
          <ArrowRight
            className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  );
}
