"use client";

import { Search } from "lucide-react";
import { useCommandPalette } from "@/components/search";

export function WelcomeBar() {
  const { open } = useCommandPalette();
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
      <button type="button" onClick={open} className="w-full sm:w-auto sm:min-w-[280px] relative">
        <div className="flex items-center gap-2 pl-9 pr-4 py-2.5 rounded-lg border bg-card text-sm text-muted-foreground hover:border-primary/30 transition-colors cursor-pointer">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" />
          Rechercher un politique, un vote...
        </div>
      </button>
    </div>
  );
}
