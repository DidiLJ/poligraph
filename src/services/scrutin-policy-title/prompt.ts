import { escapeXmlText } from "@/lib/text/escape-xml";
import type { SubstanceTextBlock, EvidenceCandidate } from "./types";

export const PROMPT_VERSION = "policy-title-v1";

export interface BuildPromptArgs {
  scrutinTitle: string;
  proceduralLabel: string;
  result: string;
  votingDate: string;
  blocks: SubstanceTextBlock[];
  candidates: EvidenceCandidate[];
  citizenImpact: string | null;
}

const SYSTEM_PROMPT = `Tu es rédacteur de vulgarisation parlementaire pour un site de transparence citoyenne.

Ta mission : transformer le libellé procédural d'un vote en un titre clair qui répond à une seule question : qu'est-ce qui change concrètement si ce vote passe ?

Écris en français, avec tous les accents (é, è, ê, à, ô, ç, ù, î, û, ë). N'utilise jamais de tiret cadratin ni de tiret demi-cadratin : préfère la virgule, les parenthèses, le deux-points ou le point.

Mauvais exemples (procéduraux, à proscrire) :
- "Rétablir l'article 8 du projet de loi agricole"
- "Adopter l'amendement du Gouvernement"

Bon exemple (concret, parle au citoyen) :
- "Limiter les dérogations aux seuils de qualité de l'eau"

Règle d'ancrage stricte : chaque affirmation concrète doit provenir des extraits du bloc <evidence> ; cite-les dans evidenceQuotes ; ne cite jamais d'autre source. Le bloc <contexte-editorial> est purement informatif et ne constitue PAS une source : n'en extrais aucune citation, ne le mentionne dans aucun evidenceQuotes.

Longueur du titre : vise 90 caractères, sans jamais dépasser 140 caractères absolus.`;

function buildSourcesXml(blocks: SubstanceTextBlock[]): string {
  if (blocks.length === 0) return "  <source />";
  return blocks
    .map(
      (b) =>
        `  <source kind="${escapeXmlText(b.sourceType)}" ref="${escapeXmlText(b.sourceId)}" field="${escapeXmlText(b.field)}" trust="${escapeXmlText(b.trust)}">${escapeXmlText(b.text)}</source>`
    )
    .join("\n");
}

function buildEvidenceXml(candidates: EvidenceCandidate[]): string {
  if (candidates.length === 0) return "  <quote />";
  return candidates
    .map(
      (c) =>
        `  <quote source-type="${escapeXmlText(c.sourceType)}" source-id="${escapeXmlText(c.sourceId)}" field="${escapeXmlText(c.field)}">${escapeXmlText(c.quote)}</quote>`
    )
    .join("\n");
}

export function buildPrompt(args: BuildPromptArgs): { system: string; user: string } {
  const { scrutinTitle, proceduralLabel, result, votingDate, blocks, candidates, citizenImpact } =
    args;

  const user = `<scrutin>
  <titreOfficiel>${escapeXmlText(scrutinTitle)}</titreOfficiel>
  <labelProcedural>${escapeXmlText(proceduralLabel)}</labelProcedural>
  <date>${escapeXmlText(votingDate)}</date>
  <resultat>${escapeXmlText(result)}</resultat>
</scrutin>

<sources>
${buildSourcesXml(blocks)}
</sources>

<evidence>
${buildEvidenceXml(candidates)}
</evidence>

<contexte-editorial role="informational-only">${escapeXmlText(citizenImpact ?? "(aucun)")}</contexte-editorial>

<format>
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, sans bloc de code. Champs attendus :
  - policyTitle (string) : le titre concret, 90 caractères cible, 140 maximum.
  - policySubtitle (string ou null) : une phrase de précision, ou null.
  - evidenceQuotes (tableau) : objets { sourceType, sourceId, field, quote } repris du bloc <evidence> uniquement.
  - selfConfidence (string) : "HIGH", "MEDIUM" ou "LOW".
  - rationale (string) : justification courte.
</format>`;

  return { system: SYSTEM_PROMPT, user };
}
