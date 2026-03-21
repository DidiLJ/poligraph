import Link from "next/link";
import { Search } from "lucide-react";

export function WelcomeBar() {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedDate = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Observatoire citoyen</h1>
        <p className="text-sm text-muted-foreground mt-1">{formattedDate}</p>
      </div>
      <Link
        href="/recherche"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors w-full sm:w-auto sm:min-w-[240px]"
      >
        <Search className="h-4 w-4" />
        Rechercher un politique, un vote...
      </Link>
    </div>
  );
}
