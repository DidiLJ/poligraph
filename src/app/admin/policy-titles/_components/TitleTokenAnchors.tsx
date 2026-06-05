"use client";

import { extractContentKeywords } from "@/services/scrutin-policy-title/evidence-extractor";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EvidenceQuote } from "@/services/scrutin-policy-title/types";

/** Lowercase + strip diacritics, mirroring evidence-extractor normalization. */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Renders the policy title token by token. A token whose normalized form is a
 * content keyword grounded in at least one cited quote is underlined green
 * (anchored). Other content keywords are dotted orange (not anchored). Filler
 * words render plain. Tooltips explain each annotated token.
 */
export function TitleTokenAnchors({
  title,
  evidenceQuotes,
}: {
  title: string | null;
  evidenceQuotes: EvidenceQuote[];
}) {
  if (!title) return null;

  // Content keywords present in any cited quote (normalized set).
  const groundedKeywords = new Set<string>();
  for (const q of evidenceQuotes) {
    for (const kw of extractContentKeywords(q.quote)) {
      groundedKeywords.add(kw);
    }
  }

  // The title's own content keywords (normalized).
  const titleKeywords = new Set(extractContentKeywords(title));

  // Split keeping the whitespace separators so spacing is preserved.
  const parts = title.split(/(\s+)/);

  return (
    <TooltipProvider>
      <p className="text-lg font-semibold leading-relaxed">
        {parts.map((part, i) => {
          if (/^\s+$/.test(part) || part === "") {
            return <span key={i}>{part}</span>;
          }
          const norm = normalize(part).replace(/[^a-z0-9-]/g, "");
          const isContent = titleKeywords.has(norm);
          if (!isContent) {
            return <span key={i}>{part}</span>;
          }
          const grounded = groundedKeywords.has(norm);
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "cursor-help",
                    grounded
                      ? "underline decoration-green-600 decoration-2 underline-offset-4"
                      : "underline decoration-dotted decoration-orange-500 decoration-2 underline-offset-4"
                  )}
                >
                  {part}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {grounded
                  ? "Mot-clé recoupé dans une citation officielle."
                  : "Mot-clé absent des citations : à vérifier dans la source."}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </p>
    </TooltipProvider>
  );
}
