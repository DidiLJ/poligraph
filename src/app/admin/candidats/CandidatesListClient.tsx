"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CandidatePresidentialRow } from "@/lib/data/candidates";

const STATUS_LABELS: Record<string, string> = {
  DECLARE: "Déclaré",
  PRESSENTI: "Pressenti",
  ENVISAGE: "Envisagé",
  RETIRE: "Retiré",
};

interface Props {
  initialCandidates: CandidatePresidentialRow[];
}

export function CandidatesListClient({ initialCandidates }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function patchPresidential(id: string, body: Record<string, unknown>) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/candidats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2">Rang</th>
            <th className="text-left px-3 py-2">Candidat</th>
            <th className="text-left px-3 py-2">Parti</th>
            <th className="text-left px-3 py-2">Statut</th>
            <th className="text-left px-3 py-2">Slogan</th>
            <th className="text-left px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {initialCandidates.map((c) => {
            const pres = c.presidentialData;
            const slug = c.politician?.slug;
            return (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2 w-12">
                  <input
                    type="number"
                    min={0}
                    defaultValue={pres?.rank ?? ""}
                    onBlur={(e) => {
                      const value = e.target.value ? Number(e.target.value) : null;
                      if (pres) patchPresidential(pres.id, { rank: value });
                    }}
                    className="w-12 rounded border px-1 py-0.5 text-sm dark:bg-slate-800"
                    aria-label={`Rang de ${c.candidateName}`}
                    disabled={busy === pres?.id || !pres}
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {slug ? (
                    <Link
                      href={`/admin/candidats/${slug}`}
                      className="text-primary hover:underline"
                    >
                      {c.candidateName}
                    </Link>
                  ) : (
                    <span>{c.candidateName}</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {c.party?.shortName ?? c.partyLabel ?? "-"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {STATUS_LABELS[c.status ?? ""] ?? c.status ?? ""}
                </td>
                <td className="px-3 py-2 max-w-md">
                  <input
                    type="text"
                    defaultValue={pres?.slogan ?? ""}
                    onBlur={(e) => {
                      const value = e.target.value.trim() || null;
                      if (pres) patchPresidential(pres.id, { slogan: value });
                    }}
                    className="w-full rounded border px-2 py-0.5 text-sm dark:bg-slate-800"
                    aria-label={`Slogan de ${c.candidateName}`}
                    disabled={busy === pres?.id || !pres}
                    placeholder={pres ? "ex : Vous protéger" : "Métadonnées absentes"}
                  />
                </td>
                <td className="px-3 py-2">
                  {slug && (
                    <Link
                      href={`/admin/candidats/${slug}`}
                      className="text-primary hover:underline"
                    >
                      Voir profil
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
          {initialCandidates.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                Aucun candidat enregistré pour le moment.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="border-t bg-muted/30 p-3 text-xs text-foreground">
        Pour ajouter un candidat manquant (ex : Dominique de Villepin), recherche-le via la barre de
        recherche admin et utilise le bouton « Désigner comme candidat 2027 » depuis sa fiche
        politicien. Cette mécanique sera affinée dans une itération suivante.
      </div>
    </div>
  );
}
