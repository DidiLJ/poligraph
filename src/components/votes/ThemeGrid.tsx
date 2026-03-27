"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ThemeItem {
  theme: string;
  label: string;
  icon: string;
  colorClass: string;
  count: number;
  isActive: boolean;
  href: string;
}

interface ThemeGridProps {
  themes: ThemeItem[];
  clearHref: string;
  hasActiveTheme: boolean;
}

export function ThemeGrid({ themes, clearHref, hasActiveTheme }: ThemeGridProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleThemes = expanded ? themes : themes.slice(0, 4);

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 text-sm font-medium mb-3 hover:text-foreground text-muted-foreground transition-colors"
      >
        Filtrer par thème
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {hasActiveTheme && (
          <Link
            href={clearHref}
            className="flex items-center gap-2 p-3 rounded-lg border bg-primary text-primary-foreground min-h-[60px] text-sm font-medium transition-colors"
          >
            Tous les thèmes
          </Link>
        )}
        {visibleThemes.map((t) => (
          <Link
            key={t.theme}
            href={t.href}
            className={`flex items-center gap-2 p-3 rounded-lg min-h-[60px] transition-colors ${
              t.isActive
                ? "border-l-4 border-l-primary bg-primary/5 border border-primary/20"
                : "bg-muted hover:bg-muted/80 border border-border"
            }`}
          >
            <span className="text-lg">{t.icon}</span>
            <span className="text-sm font-medium">{t.label}</span>
          </Link>
        ))}
      </div>

      {themes.length > 4 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          + {themes.length - 4} thèmes
        </button>
      )}
    </div>
  );
}
