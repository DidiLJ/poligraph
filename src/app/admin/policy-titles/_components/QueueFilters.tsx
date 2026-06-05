"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_OPTIONS = ["DRAFT", "NEEDS_REVIEW", "APPROVED", "REJECTED", "STALE"];
const CONFIDENCE_OPTIONS = ["HIGH", "MEDIUM", "LOW"];
const SOURCE_OPTIONS = ["LLM", "FALLBACK", "MANUAL", "DETERMINISTIC"];
const SEVERITY_OPTIONS = [
  { value: "blocker", label: "Bloquant" },
  { value: "warn", label: "Avertissement" },
  { value: "clean", label: "Propre" },
];
const DEPTH_OPTIONS = [
  { value: "subAmendment", label: "Sous-amendement" },
  { value: "amendment", label: "Amendement" },
  { value: "exposeDesMotifs", label: "Exposé des motifs" },
  { value: "null", label: "Aucune (fallback)" },
];
const WARNING_CODES = [
  "LLM_OUTPUT_INVALID",
  "SUB_TARGET_NOT_CITED",
  "EVIDENCE_GROUNDING",
  "EVIDENCE_TRUST",
  "ARTICLE_ONLY",
  "LENGTH",
  "NO_DASH",
  "NO_SUBSTANCE_FOUND",
];
const SORT_OPTIONS = [
  { value: "votingDate", label: "Date de scrutin" },
  { value: "confidence", label: "Confiance" },
  { value: "generatedAt", label: "Date de génération" },
];

function getMulti(params: URLSearchParams, key: string): string[] {
  return params.getAll(key);
}

export function QueueFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  // Build a working copy we can mutate then push.
  function push(mutate: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(searchParams.toString());
    mutate(p);
    // Any filter change resets pagination + sample.
    p.delete("skip");
    router.push(`/admin/policy-titles?${p.toString()}`);
  }

  function toggleMulti(key: string, value: string) {
    push((p) => {
      const current = p.getAll(key);
      p.delete(key);
      if (current.includes(value)) {
        for (const v of current) if (v !== value) p.append(key, v);
      } else {
        for (const v of current) p.append(key, v);
        p.append(key, value);
      }
      p.delete("sample");
    });
  }

  function setSingle(key: string, value: string) {
    push((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      p.delete("sample");
    });
  }

  function toggleBool(key: string) {
    push((p) => {
      if (p.get(key) === "true") p.delete(key);
      else p.set(key, "true");
      p.delete("sample");
    });
  }

  function applySample(extra: (p: URLSearchParams) => void) {
    push((p) => {
      // Quick samples reset all other filters for a focused random pull.
      const keys = [...p.keys()];
      for (const k of keys) p.delete(k);
      extra(p);
      p.set("sample", "10");
    });
  }

  const selectedStatuses = getMulti(searchParams, "status");
  const selectedConfidence = getMulti(searchParams, "confidence");
  const selectedSources = getMulti(searchParams, "generationSource");
  const selectedDepths = getMulti(searchParams, "substanceDepth");

  function chip(active: boolean) {
    return `px-2.5 py-1 text-xs rounded-full border transition-colors ${
      active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
    }`;
  }

  return (
    <div className="space-y-3">
      {/* Quick random sample buttons (per revision #7) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Échantillon aléatoire (10) :
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => applySample((p) => p.append("status", "DRAFT"))}
        >
          DRAFT
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => applySample((p) => p.append("confidence", "HIGH"))}
        >
          Confiance haute
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => applySample((p) => p.set("subAmendmentOnly", "true"))}
        >
          Sous-amendements
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => applySample((p) => p.append("status", "NEEDS_REVIEW"))}
        >
          NEEDS_REVIEW
        </Button>
      </div>

      {/* Disclosure for the full filter set (collapses on small screens) */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="md:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? "Masquer les filtres" : "Filtres"}
      </Button>

      <div
        className={`${open ? "block" : "hidden"} md:block space-y-4 rounded-lg border border-border p-4`}
      >
        {/* Search */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="q" className="text-xs">
              Recherche (titre officiel ou généré)
            </Label>
            <Input
              id="q"
              type="search"
              defaultValue={searchParams.get("q") ?? ""}
              placeholder="Mot-clé…"
              onKeyDown={(e) => {
                if (e.key === "Enter") setSingle("q", (e.target as HTMLInputElement).value);
              }}
            />
          </div>
          <div className="min-w-[180px]">
            <Label htmlFor="sort" className="text-xs">
              Tri
            </Label>
            <Select
              id="sort"
              value={searchParams.get("sort") ?? "votingDate"}
              onChange={(e) => setSingle("sort", e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[180px]">
            <Label htmlFor="warningCode" className="text-xs">
              Code d&apos;avertissement
            </Label>
            <Select
              id="warningCode"
              value={searchParams.get("warningCode") ?? ""}
              onChange={(e) => setSingle("warningCode", e.target.value)}
            >
              <option value="">Tous</option>
              {WARNING_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Status chips */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Statut</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={chip(selectedStatuses.includes(s))}
                onClick={() => toggleMulti("status", s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence chips */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Confiance</p>
          <div className="flex flex-wrap gap-1.5">
            {CONFIDENCE_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                className={chip(selectedConfidence.includes(c))}
                onClick={() => toggleMulti("confidence", c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Source chips */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Source</p>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={chip(selectedSources.includes(s))}
                onClick={() => toggleMulti("generationSource", s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Substance depth chips */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Profondeur de substance</p>
          <div className="flex flex-wrap gap-1.5">
            {DEPTH_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                className={chip(selectedDepths.includes(d.value))}
                onClick={() => toggleMulti("substanceDepth", d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Severity + length + toggles */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[160px]">
            <Label htmlFor="severity" className="text-xs">
              Sévérité
            </Label>
            <Select
              id="severity"
              value={searchParams.get("severity") ?? ""}
              onChange={(e) => setSingle("severity", e.target.value)}
            >
              <option value="">Toutes</option>
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-28">
            <Label htmlFor="titleLengthMin" className="text-xs">
              Longueur min
            </Label>
            <Input
              id="titleLengthMin"
              type="number"
              min={0}
              defaultValue={searchParams.get("titleLengthMin") ?? ""}
              onBlur={(e) => setSingle("titleLengthMin", e.target.value)}
            />
          </div>
          <div className="w-28">
            <Label htmlFor="titleLengthMax" className="text-xs">
              Longueur max
            </Label>
            <Input
              id="titleLengthMax"
              type="number"
              min={0}
              defaultValue={searchParams.get("titleLengthMax") ?? ""}
              onBlur={(e) => setSingle("titleLengthMax", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={searchParams.get("nullTitle") === "true"}
              onChange={() => toggleBool("nullTitle")}
            />
            Titre absent (fallback)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={searchParams.get("subAmendmentOnly") === "true"}
              onChange={() => toggleBool("subAmendmentOnly")}
            />
            Sous-amendements uniquement
          </label>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/policy-titles")}
        >
          Réinitialiser les filtres
        </Button>
      </div>
    </div>
  );
}
