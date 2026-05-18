import Link from "next/link";
import { THEME_CATEGORY_LABELS } from "@/config/labels";
import type { ThemeCategory } from "@/types";

export interface PromiseItem {
  id: string;
  text: string;
  theme: ThemeCategory;
  themeConfidence: number | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  publishedAt: Date;
}

interface Props {
  promises: PromiseItem[];
  politicianSlug: string;
  maxInline?: number;
}

export function PromisesSection({ promises, politicianSlug, maxInline = 3 }: Props) {
  if (promises.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        Aucune promesse extraite pour ce candidat. Lancer le pipeline d{"'"}extraction (cf. sub-plan
        H) pour produire des promesses.
      </div>
    );
  }

  const inline = promises.slice(0, maxInline);
  const total = promises.length;

  return (
    <section
      className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
      aria-labelledby="promises-section-heading"
    >
      <h3
        id="promises-section-heading"
        className="text-sm font-semibold text-slate-700 dark:text-slate-100"
      >
        {total} promesses extraites, top {inline.length}
      </h3>
      <ul className="mt-3 space-y-2">
        {inline.map((p) => (
          <li key={p.id} className="border-l-4 border-primary pl-3">
            <p className="text-sm text-slate-900 dark:text-slate-100">{p.text}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{THEME_CATEGORY_LABELS[p.theme]}</span>
              {p.sourceLabel && (
                <>
                  <span aria-hidden="true"> · </span>
                  {p.sourceUrl ? (
                    <a
                      href={p.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline"
                    >
                      {p.sourceLabel}
                    </a>
                  ) : (
                    p.sourceLabel
                  )}
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
      {total > inline.length && (
        <Link
          href={`/admin/politiques/${politicianSlug}#promesses`}
          className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
        >
          Voir les {total} promesses →
        </Link>
      )}
    </section>
  );
}
