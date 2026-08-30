"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateContextDraftBatchAction } from "../actions";

export function ContextGenerationBatchPanel({ measureIds }: { measureIds: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const ids = measureIds.slice(0, 10);

  if (ids.length === 0) return null;

  return (
    <section
      aria-labelledby="context-generation-title"
      className="rounded-lg border border-border p-4"
    >
      <h2 id="context-generation-title" className="font-display text-lg font-bold">
        Génération assistée des contextes
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Traite jusqu’à 10 mesures de cette page. Chaque résultat reste un brouillon non public,
        fondé uniquement sur les preuves enregistrées.
      </p>
      <button
        type="button"
        disabled={pending}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              const result = await generateContextDraftBatchAction({ measureIds: ids });
              setMessage(
                `${result.created} brouillon${result.created === 1 ? " créé" : "s créés"}, ${result.skipped} ignoré${result.skipped === 1 ? "" : "s"}, ${result.failed} échec${result.failed === 1 ? "" : "s"}.`
              );
              router.refresh();
            } catch {
              setMessage("La génération du lot a échoué. Réessayez plus tard.");
            }
          });
        }}
      >
        {pending
          ? "Génération en cours…"
          : ids.length === 1
            ? "Générer 1 contexte"
            : `Générer jusqu’à ${ids.length} contextes`}
      </button>
      {message && (
        <p role="status" aria-live="polite" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
