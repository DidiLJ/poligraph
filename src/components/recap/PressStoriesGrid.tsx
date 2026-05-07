import Link from "next/link";
import type { PressStory } from "@/lib/data/recap";

interface Props {
  stories: PressStory[];
}

const SOURCE_NAMES: Record<string, string> = {
  lemonde: "Le Monde",
  politico: "Politico",
  mediapart: "Mediapart",
};

export function PressStoriesGrid({ stories }: Props) {
  if (stories.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun article cette semaine.</p>;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {stories.map((story) => {
        const sourceName = SOURCE_NAMES[story.feedSource] ?? story.feedSource;
        const dateStr = new Date(story.publishedAt).toLocaleDateString("fr-FR", {
          timeZone: "UTC",
        });
        return (
          <article key={story.articleId} className="rounded-lg border bg-card p-4 flex flex-col">
            {story.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={story.imageUrl}
                alt=""
                className="mb-3 aspect-video w-full rounded object-cover"
                loading="lazy"
              />
            ) : null}

            <h3 className="mb-2 text-base font-semibold leading-snug">
              <a
                href={story.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                {story.title}
              </a>
            </h3>

            <p className="mb-3 text-xs text-muted-foreground">
              {sourceName} · {dateStr}
            </p>

            {story.mentions.politicians.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {story.mentions.politicians.slice(0, 4).map((p) => (
                  <Link
                    key={p.slug}
                    href={`/politiques/${p.slug}`}
                    prefetch={false}
                    className="rounded bg-muted px-2 py-0.5 text-xs hover:bg-accent"
                  >
                    {p.fullName}
                  </Link>
                ))}
              </div>
            ) : null}

            {story.mentions.affairs.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {story.mentions.affairs.slice(0, 2).map((a) => (
                  <Link
                    key={a.slug}
                    href={`/affaires/${a.slug}`}
                    prefetch={false}
                    className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-900 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-200"
                  >
                    Affaire : {a.title}
                  </Link>
                ))}
              </div>
            ) : null}

            {story.aiSummary ? (
              <p className="mt-auto text-sm italic text-muted-foreground">{story.aiSummary}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
