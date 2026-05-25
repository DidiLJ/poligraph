"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeFocusRadar, type ThemeFocusItem } from "./ThemeFocusRadar";
import { THEME_CATEGORY_LABELS } from "@/config/labels";
import { formatProbityBreakdown, type ProbityStats } from "@/lib/affairs/probity-stats-format";
import type { ThemeCategory } from "@/types";

export interface CompareCandidate {
  slug: string;
  name: string;
  partyShortName: string | null;
  partyColor: string | null;
  slogan: string | null;
  promisesCount: number;
  affairsCount: number;
  probityStats: ProbityStats;
  topPromises: Array<{
    id: string;
    text: string;
    theme: ThemeCategory;
  }>;
  themeFocus: ThemeFocusItem[];
}

interface Props {
  left: CompareCandidate;
  right: CompareCandidate;
}

export function CompareView({ left, right }: Props) {
  const [mobileSelected, setMobileSelected] = useState<"left" | "right">("left");

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-2 gap-2">
        <CandidateCard candidate={left} />
        <CandidateCard candidate={right} />
      </div>

      <div className="lg:hidden">
        <div
          role="tablist"
          className="sticky top-0 z-10 flex gap-1 bg-white py-2 dark:bg-slate-950"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobileSelected === "left"}
            onClick={() => setMobileSelected("left")}
            className={`flex-1 rounded px-3 py-2 text-xs font-semibold ${
              mobileSelected === "left"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {left.name}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileSelected === "right"}
            onClick={() => setMobileSelected("right")}
            className={`flex-1 rounded px-3 py-2 text-xs font-semibold ${
              mobileSelected === "right"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {right.name}
          </button>
        </div>
      </div>

      <CompareBlock title="Radar des axes de focalisation">
        <div className="hidden gap-3 lg:grid lg:grid-cols-2">
          <ThemeFocusRadar
            items={left.themeFocus}
            candidateName={left.name}
            accentColor={left.partyColor ?? undefined}
          />
          <ThemeFocusRadar
            items={right.themeFocus}
            candidateName={right.name}
            accentColor={right.partyColor ?? undefined}
          />
        </div>
        <div className={`lg:hidden ${mobileSelected === "left" ? "" : "hidden"}`}>
          <ThemeFocusRadar
            items={left.themeFocus}
            candidateName={left.name}
            accentColor={left.partyColor ?? undefined}
          />
        </div>
        <div className={`lg:hidden ${mobileSelected === "right" ? "" : "hidden"}`}>
          <ThemeFocusRadar
            items={right.themeFocus}
            candidateName={right.name}
            accentColor={right.partyColor ?? undefined}
          />
        </div>
      </CompareBlock>

      <CompareBlock title="Promesses (top)">
        <div className="grid gap-3 lg:grid-cols-2">
          <PromiseColumn promises={left.topPromises} accentColor={left.partyColor} />
          <PromiseColumn promises={right.topPromises} accentColor={right.partyColor} />
        </div>
      </CompareBlock>

      <CompareBlock title="Comptes synthétiques">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th scope="col" className="px-3 py-2 text-left">
                <span className="sr-only">Indicateur</span>
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                {left.name}
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                {right.name}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200 dark:border-slate-700">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                Promesses extraites
              </th>
              <td className="px-3 py-2">{left.promisesCount}</td>
              <td className="px-3 py-2">{right.promisesCount}</td>
            </tr>
            <tr className="border-t border-slate-200 dark:border-slate-700">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                Atteintes à la probité
              </th>
              <td className="px-3 py-2">
                <ProbityCell stats={left.probityStats} />
              </td>
              <td className="px-3 py-2">
                <ProbityCell stats={right.probityStats} />
              </td>
            </tr>
            <tr className="border-t border-slate-200 dark:border-slate-700">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                Total affaires judiciaires
              </th>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{left.affairsCount}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{right.affairsCount}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[11px] italic text-slate-500 dark:text-slate-400">
          Atteintes à la probité (corruption, détournement, prise illégale d{"'"}intérêts, emplois
          fictifs) ciblées car spécifiques au mandat politique. Présomption d{"'"}innocence
          respectée.
        </p>
      </CompareBlock>

      <p className="text-xs italic text-slate-500 dark:text-slate-400">
        Vue de comparaison factuelle. Pas de classement ni de score d{"'"}affrontement.
      </p>

      <Link
        href={`/admin/candidats/${left.slug}`}
        className="inline-block text-sm font-semibold text-primary hover:underline"
      >
        ← Retour au profil {left.name}
      </Link>
    </div>
  );
}

function ProbityCell({ stats }: { stats: ProbityStats }) {
  return (
    <div>
      <span className="text-base font-bold tabular-nums">{stats.total}</span>
      {stats.total > 0 && (
        <div className="mt-0.5 text-[11px] leading-tight text-slate-600 dark:text-slate-400">
          {formatProbityBreakdown(stats)}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: CompareCandidate }) {
  const accent = candidate.partyColor ?? "#3b82f6";
  return (
    <div
      className="rounded-lg p-3 text-xs text-white"
      style={{ background: `linear-gradient(135deg, ${accent}aa, ${accent})` }}
    >
      <div className="text-sm font-bold">{candidate.name}</div>
      <div className="opacity-90">{candidate.partyShortName ?? ""}</div>
      {candidate.slogan && <div className="mt-1 italic">« {candidate.slogan} »</div>}
    </div>
  );
}

function CompareBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {title.toUpperCase()}
      </h3>
      {children}
    </section>
  );
}

function PromiseColumn({
  promises,
  accentColor,
}: {
  promises: CompareCandidate["topPromises"];
  accentColor: string | null;
}) {
  return (
    <ul className="space-y-2">
      {promises.length === 0 && (
        <li className="text-xs text-slate-500">Aucune promesse extraite.</li>
      )}
      {promises.map((p) => (
        <li
          key={p.id}
          className="border-l-4 pl-3 text-sm text-slate-900 dark:text-slate-100"
          style={{ borderColor: accentColor ?? "#3b82f6" }}
        >
          {p.text}
          <span className="ml-1 text-xs text-slate-500">· {THEME_CATEGORY_LABELS[p.theme]}</span>
        </li>
      ))}
    </ul>
  );
}
