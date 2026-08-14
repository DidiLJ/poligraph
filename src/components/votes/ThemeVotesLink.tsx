import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { themeToSlug } from "@/lib/theme-utils";
import { themeSeoPhrase } from "@/lib/seo/theme-metadata";
import type { ThemeCategory } from "@/generated/prisma";

interface ThemeVotesLinkProps {
  theme: ThemeCategory;
  className?: string;
}

/**
 * Contextual link from a themed surface (scrutin page, dossier) to its thematic
 * landing, with a descriptive anchor ("Voir tous les votes sur la santé") rather
 * than the bare label already carried by the theme badge.
 */
export function ThemeVotesLink({ theme, className }: ThemeVotesLinkProps) {
  return (
    <Link
      href={`/parlement/votes/themes/${themeToSlug(theme)}`}
      className={`inline-flex items-center gap-1.5 text-primary hover:underline ${className ?? ""}`}
    >
      Voir tous les votes sur {themeSeoPhrase(theme)}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
