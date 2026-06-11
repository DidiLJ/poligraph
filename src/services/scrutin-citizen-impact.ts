/**
 * AI generation of citizen-facing impact explanations for parliamentary votes.
 *
 * Uses Mistral (French-optimized) to generate "Ce que ca change pour vous"
 * explanations that translate procedural parliamentary language into
 * structured, scannable plain French for citizens.
 */

import { callMistral, extractMistralText, parseMistralJSON } from "@/lib/api/mistral";
import { escapeXmlText } from "@/lib/text/escape-xml";
import type { SubstanceTextBlock, SubstanceDepth } from "@/services/scrutin-policy-title/types";

const MISTRAL_MODEL = "mistral-large-latest";
const MAX_TOKENS = 2000;

// ============================================
// TYPES
// ============================================

export interface CitizenImpactInput {
  title: string;
  summary: string | null;
  theme: string | null;
  result: "ADOPTED" | "REJECTED";
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  chamber: "AN" | "SENAT";
  votingDate: string;
  dossierTitle: string | null;
  dossierSummary: string | null;
  sourcePageText: string | null;
  /**
   * OFFICIAL substance blocks from `resolveSubstanceSources` (amendment-first).
   * When non-empty, they are the SOLE basis for describing the voted measure;
   * `summary` / `dossierSummary` become background context only. Empty for
   * scrutins with no usable amendment text (whole-text votes, motions).
   */
  substanceBlocks: SubstanceTextBlock[];
  substanceDepth: SubstanceDepth | null;
  hasLinkedAmendment: boolean;
  links: {
    dossierUrl: string | null;
    dossierLabel: string | null;
    relatedVotes: { url: string; label: string }[];
    politicians: { url: string; label: string; position: string }[];
  };
}

export interface CitizenImpactOutput {
  citizenImpact: string;
  confidence: number;
}

// ============================================
// PROMPT
// ============================================

export const SYSTEM_PROMPT = `Tu es un rédacteur factuel pour Poligraph, un observatoire citoyen de la politique française.

MISSION : Expliquer factuellement ce que ce vote parlementaire change, ce que la mesure proposait, et pourquoi elle a été adoptée ou rejetée - en restant STRICTEMENT neutre. Le lecteur n'a AUCUNE connaissance juridique ou parlementaire préalable.

FORMAT OBLIGATOIRE - Utiliser du markdown structuré :
- Paragraphes courts (2-3 phrases max par paragraphe)
- Sous-titres en **gras** pour chaque section (pas de titres markdown #)
- Listes à puces pour les arguments du débat
- Utiliser le **gras** pour la mesure concrète votée
- Français courant, vouvoyer le lecteur avec "vous"
- Utiliser des liens markdown vers les pages Poligraph quand des LIENS DISPONIBLES sont fournis

STRUCTURE A SUIVRE :

**De quoi s'agit-il ?**
1-2 phrases pour poser le contexte : quelle loi, quel sujet de société. Ne JAMAIS écrire "l'article 21" sans expliquer en langage courant ce que cet article traite.

**Ce qui était proposé**
1-2 phrases sur ce que la mesure/l'amendement proposait concrètement. Mettre en **gras** la mesure clé.

**Le résultat du vote**
1 phrase sur le résultat et ce que cela implique.

**Le débat**
- **Pour :** 1-2 phrases sur les arguments des partisans
- **Contre :** 1-2 phrases sur les arguments des opposants (même poids que les arguments pour)

**Qui est concerné ?**
1 phrase sur qui est directement impacté par cette décision.

NEUTRALITÉ - RÈGLES ABSOLUES :
1. JAMAIS de jugement de valeur : pas de "bonne foi", "juste", "important", "nécessaire", "dangereux"
2. JAMAIS présenter un résultat comme positif ou négatif - décrire factuellement ce qui change
3. Présenter les arguments POUR et CONTRE avec le même poids et la même longueur
4. Ne PAS rassurer le lecteur - c'est du parti-pris
5. Ne PAS utiliser de formulations qui prennent parti : "renforcer la lutte contre" (= c'est bien). Préférer : "augmenter les contrôles sur..."
6. Vote ADOPTÉ : "cette mesure entre en vigueur" / "cela signifie que..."
7. Vote REJETÉ : "cette mesure n'a pas été retenue" / "le texte initial est maintenu"
8. Traduire TOUT le jargon parlementaire en français courant
9. JAMAIS inventer de mesures concrètes absentes des données fournies
10. Si les données sont trop minces pour identifier un impact citoyen : confidence < 40
11. Votes purement procéduraux : confidence < 40
12. Ne PAS commencer par "Ce vote..." - varier les accroches
13. Si le scrutin porte sur un amendement, expliquer DANS LE CONTEXTE DE LA LOI ce que l'amendement proposait de modifier
14. Pour les motions de censure : seuls les députés favorables à la censure votent POUR. La motion est rejetée si le seuil de majorité absolue (289/577) n'est pas atteint, PAS parce que des députés ont voté contre.

VULGARISATION - RÈGLES CRITIQUES :
15. JAMAIS référencer un numéro d'article seul - TOUJOURS expliquer en langage courant le sujet
16. JAMAIS utiliser de termes techniques sans les expliquer
17. Commencer par poser le CONTEXTE concret avant d'entrer dans le détail
18. JAMAIS briser le 4e mur ("sans avoir le contenu exact", "les informations disponibles"). Si tu ne sais pas, confidence < 40
19. Si le titre mentionne un "projet de loi relatif à X", expliquer ce que X signifie concrètement

SOURCES OFFICIELLES - RÈGLES PRIORITAIRES :
20. Si un bloc <sources-officielles> est fourni, la section "Ce qui était proposé" doit décrire UNIQUEMENT la mesure contenue dans ce bloc (c'est le texte exact de l'amendement voté). C'est ta seule source pour la mesure.
21. Dans ce cas, le CONTEXTE GÉNÉRAL (résumé du scrutin, résumé du dossier, titre) ne sert qu'à poser le décor de la loi. Il est INTERDIT de t'en servir pour décrire ce que l'amendement proposait : ces textes parlent de la loi entière, pas de cet amendement précis.
22. Si <sources-officielles> ne permet pas d'identifier une mesure concrète, ne l'invente pas à partir du contexte général : confidence < 40.

RÉPONSE : Tu DOIS répondre en JSON avec exactement deux champs :
- "citizen_impact" : l'explication en markdown structuré
- "confidence" : entier 0-100 (80+ = impact clair, 40-79 = indirect, <40 = procédural)`;

// ============================================
// MAIN FUNCTION
// ============================================

export async function generateCitizenImpact(
  input: CitizenImpactInput
): Promise<CitizenImpactOutput> {
  const userMessage = buildUserMessage(input);

  const response = await callMistral([{ role: "user", content: userMessage }], {
    model: MISTRAL_MODEL,
    maxTokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    temperature: 0.3,
    responseFormat: { type: "json_object" },
  });

  const text = extractMistralText(response);

  try {
    const parsed = parseMistralJSON<{ citizen_impact: string; confidence: number }>(text);
    return {
      citizenImpact: sanitizeOutput(parsed.citizen_impact ?? ""),
      confidence: parsed.confidence ?? 0,
    };
  } catch {
    return { citizenImpact: "", confidence: 0 };
  }
}

export { MISTRAL_MODEL };

// ============================================
// HELPERS
// ============================================

function sanitizeOutput(text: string): string {
  let result = text;
  result = result.replace(/https?:\/\/(assemblee|votes|partis|elections|politiques)\//g, "/$1/");
  result = result.replace(/\]\(\((\/.+?)\)\)/g, "]($1)");
  return result;
}

/**
 * Renders the OFFICIAL amendment substance as an XML block. One <source> per
 * resolved block, carrying its provenance (type, field, trust, amendment number,
 * article ref). This is the SOLE measure-bearing source when present.
 */
function buildOfficialSourcesXml(blocks: SubstanceTextBlock[]): string {
  return blocks
    .map((b) => {
      const amd = b.meta?.amendmentNumber
        ? ` amendement="${escapeXmlText(b.meta.amendmentNumber)}"`
        : "";
      const art = b.meta?.articleRef ? ` article="${escapeXmlText(b.meta.articleRef)}"` : "";
      return `  <source type="${escapeXmlText(b.sourceType)}" ref="${escapeXmlText(b.sourceId)}" field="${escapeXmlText(b.field)}" trust="${escapeXmlText(b.trust)}"${amd}${art}>${escapeXmlText(b.text)}</source>`;
    })
    .join("\n");
}

export function buildUserMessage(input: CitizenImpactInput): string {
  const sections: string[] = [];
  const hasOfficial = input.substanceBlocks.length > 0;

  sections.push(`SCRUTIN : ${input.title}`);
  sections.push(
    `Résultat : ${input.result === "ADOPTED" ? "ADOPTÉ" : "REJETÉ"} (${input.votesFor} pour, ${input.votesAgainst} contre, ${input.votesAbstain} abstentions)`
  );
  sections.push(`Chambre : ${input.chamber === "AN" ? "Assemblée nationale" : "Sénat"}`);
  sections.push(`Date : ${input.votingDate}`);
  if (input.theme) sections.push(`Thème : ${input.theme}`);

  if (hasOfficial) {
    // OFFICIAL amendment text — the only basis for "Ce qui était proposé".
    sections.push("");
    sections.push(
      'SOURCES OFFICIELLES (texte exact de l\'amendement voté — SEULE base pour décrire la mesure dans "Ce qui était proposé") :'
    );
    sections.push("<sources-officielles>");
    sections.push(buildOfficialSourcesXml(input.substanceBlocks));
    sections.push("</sources-officielles>");

    // Everything else is background only. Demoted, explicitly non-measure.
    const contextLines: string[] = [];
    if (input.summary) contextLines.push(`Résumé du scrutin : ${input.summary}`);
    if (input.dossierTitle) contextLines.push(`Loi concernée : ${input.dossierTitle}`);
    if (input.dossierSummary) contextLines.push(`Résumé du dossier : ${input.dossierSummary}`);
    if (input.sourcePageText) contextLines.push(`Page source : ${input.sourcePageText}`);
    if (contextLines.length > 0) {
      sections.push("");
      sections.push(
        'CONTEXTE GÉNÉRAL (pose le décor de la loi — NE décrit PAS la mesure votée, ne PAS l\'utiliser pour "Ce qui était proposé") :'
      );
      sections.push(...contextLines);
    }
  } else {
    // Legacy layout: no usable amendment text (whole-text vote, motion, etc.).
    if (input.summary) {
      sections.push("");
      sections.push("RÉSUMÉ EXISTANT :");
      sections.push(input.summary);
    }

    if (input.dossierTitle || input.dossierSummary) {
      sections.push("");
      sections.push("DOSSIER LÉGISLATIF :");
      if (input.dossierTitle) sections.push(`Titre : ${input.dossierTitle}`);
      if (input.dossierSummary) sections.push(`Résumé : ${input.dossierSummary}`);
    }

    if (input.sourcePageText) {
      sections.push("");
      sections.push("CONTENU DE LA PAGE SOURCE :");
      sections.push(input.sourcePageText);
    }
  }

  const linkLines: string[] = [];
  if (input.links.dossierUrl) {
    linkLines.push(`Dossier législatif : [${input.links.dossierLabel}](${input.links.dossierUrl})`);
  }
  for (const v of input.links.relatedVotes) {
    linkLines.push(`Vote lié : [${v.label}](${v.url})`);
  }
  for (const p of input.links.politicians) {
    linkLines.push(`Député·e (${p.position}) : [${p.label}](${p.url})`);
  }
  if (linkLines.length > 0) {
    sections.push("");
    sections.push("LIENS DISPONIBLES (à insérer dans l'explication quand pertinent) :");
    sections.push(...linkLines);
  }

  return sections.join("\n");
}

// ============================================
// COHERENCE GUARD
// ============================================

/**
 * Below this fraction of the official reference vocabulary echoed in the
 * generated impact, the impact is treated as ungrounded: the model likely
 * described a measure from the broad dossier context, not the linked amendment
 * (the scrutin-2084 failure mode). WEAK lexical signal, not legal correctness.
 */
export const MIN_REFERENCE_COVERAGE = 0.3;
const COVERAGE_PREFIX_LEN = 6;

/** Frequent French words (len >= 5) carrying no topical signal; excluded so
 *  shared prose boilerplate cannot inflate the coverage score. */
const COVERAGE_STOPWORDS = new Set([
  "leurs",
  "cette",
  "celle",
  "celles",
  "comme",
  "entre",
  "selon",
  "ainsi",
  "aussi",
  "toute",
  "toutes",
  "aurait",
  "auraient",
  "etait",
  "etaient",
  "avait",
  "avaient",
  "seront",
  "quand",
  "alors",
  "parce",
  "memes",
]);

function normalizeForCoverage(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Salient stemmed prefixes of a text: tokens len >= 5, stop-words optionally
 *  removed, truncated to a fixed prefix to tolerate simple inflection. */
function coveragePrefixes(s: string, opts?: { dropStopwords?: boolean }): Set<string> {
  const set = new Set<string>();
  for (const w of normalizeForCoverage(s).split(" ")) {
    if (w.length < 5) continue;
    if (opts?.dropStopwords && COVERAGE_STOPWORDS.has(w)) continue;
    set.add(w.slice(0, COVERAGE_PREFIX_LEN));
  }
  return set;
}

/**
 * Fraction of the reference's salient terms that appear in the impact text.
 * Returns 1 when the reference has no salient term (nothing to compare against,
 * so never blocks).
 */
export function computeReferenceCoverage(impactText: string, referenceText: string): number {
  const ref = coveragePrefixes(referenceText, { dropStopwords: true });
  if (ref.size === 0) return 1;
  const hay = coveragePrefixes(impactText);
  let hits = 0;
  for (const term of ref) if (hay.has(term)) hits++;
  return hits / ref.size;
}

export interface CoherenceVerdict {
  coherent: boolean;
  coverage: number;
  referenceUsed: "policyTitle" | "amendment" | "none";
}

/**
 * Confronts a generated citizen impact with the OFFICIAL reference (the approved
 * policy title when present, else the resolved amendment substance). If the
 * impact shares too little vocabulary with that reference, it likely describes a
 * different measure and must not auto-persist.
 */
export function assessCitizenImpactCoherence(args: {
  impactText: string;
  policyTitle?: string | null;
  policySubtitle?: string | null;
  blocks: SubstanceTextBlock[];
}): CoherenceVerdict {
  const titleRef = [args.policyTitle, args.policySubtitle].filter(Boolean).join(" ").trim();
  let referenceText = "";
  let referenceUsed: CoherenceVerdict["referenceUsed"] = "none";
  if (titleRef) {
    referenceText = titleRef;
    referenceUsed = "policyTitle";
  } else if (args.blocks.length > 0) {
    referenceText = args.blocks.map((b) => b.text).join(" ");
    referenceUsed = "amendment";
  }

  if (referenceUsed === "none") {
    return { coherent: true, coverage: 1, referenceUsed };
  }

  const coverage = computeReferenceCoverage(args.impactText, referenceText);
  return { coherent: coverage >= MIN_REFERENCE_COVERAGE, coverage, referenceUsed };
}
