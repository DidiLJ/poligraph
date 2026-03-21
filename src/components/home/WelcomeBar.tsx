"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

export function WelcomeBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedDate = today.charAt(0).toUpperCase() + today.slice(1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/recherche?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/recherche");
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Observatoire citoyen</h1>
        <p className="text-sm text-muted-foreground mt-1">{formattedDate}</p>
      </div>
      <form onSubmit={handleSubmit} className="w-full sm:w-auto sm:min-w-[240px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un politique, un vote..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border bg-card text-sm text-foreground placeholder:text-muted-foreground hover:border-primary/30 focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-colors"
          />
        </div>
      </form>
    </div>
  );
}
