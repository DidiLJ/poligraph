/**
 * AI generation of citizen-facing impact explanations for parliamentary votes.
 *
 * Generates "Ce que ca change pour vous" explanations that translate
 * procedural parliamentary language into plain French for citizens.
 */

import { callAnthropic, extractToolUse } from "@/lib/api/anthropic";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-5-20250929";
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
  // Enriched context (optional)
  dossierTitle: string | null;
  dossierSummary: string | null;
  sourcePageText: string | null;
  // Internal links for the AI to embed as markdown
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
// TOOL DEFINITION
// ============================================

const CITIZEN_IMPACT_TOOL = {
  name: "explain_citizen_impact",
  description:
    "Explique en langage clair ce que ce vote parlementaire change concretement pour les citoyens francais.",
  input_schema: {
    type: "object" as const,
    properties: {
      citizen_impact: {
        type: "string",
        description:
          "Explication factuelle et neutre en français courant, structuree en sections markdown. " +
          "Utilise des sous-titres **gras**, des listes a puces, et des paragraphes courts. " +
          "NEUTRALITE STRICTE. Vouvoie le lecteur.",
      },
      confidence: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description:
          "Confiance dans la pertinence de l'explication (0-100). " +
          "80+ si l'impact citoyen est clair et concret. " +
          "40-79 si l'explication est correcte mais l'impact reste indirect ou abstrait. " +
          "< 40 si c'est un vote purement procedural sans impact citoyen identifiable.",
      },
    },
    required: ["citizen_impact", "confidence"],
  },
};

const SYSTEM_PROMPT = `Tu es un redacteur factuel pour Poligraph, un observatoire citoyen de la politique francaise.

MISSION : Expliquer factuellement ce que ce vote parlementaire change, ce que la mesure proposait, et pourquoi elle a ete adoptee ou rejetee - en restant STRICTEMENT neutre. Le lecteur n'a AUCUNE connaissance juridique ou parlementaire prealable.

FORMAT OBLIGATOIRE - Utiliser du markdown structure :
- Paragraphes courts (2-3 phrases max par paragraphe)
- Sous-titres en **gras** pour chaque section (pas de titres markdown #)
- Listes a puces pour les arguments du debat
- Utiliser le **gras** pour la mesure concrete votee
- Francais courant, vouvoyer le lecteur avec "vous"
- Utiliser des liens markdown vers les pages Poligraph quand des LIENS DISPONIBLES sont fournis

STRUCTURE A SUIVRE :

**De quoi s'agit-il ?**
1-2 phrases pour poser le contexte : quelle loi, quel sujet de societe. Ne JAMAIS ecrire "l'article 21" sans expliquer en langage courant ce que cet article traite.

**Ce qui etait propose**
1-2 phrases sur ce que la mesure/l'amendement proposait concretement. Mettre en **gras** la mesure cle.

**Le resultat du vote**
1 phrase sur le resultat et ce que cela implique.

**Le debat**
- **Pour :** 1-2 phrases sur les arguments des partisans
- **Contre :** 1-2 phrases sur les arguments des opposants (meme poids que les arguments pour)

**Qui est concerne ?**
1 phrase sur qui est directement impacte par cette decision.

NEUTRALITE - REGLES ABSOLUES :
1. JAMAIS de jugement de valeur : pas de "bonne foi", "juste", "important", "necessaire", "dangereux"
2. JAMAIS presenter un resultat comme positif ou negatif - decrire factuellement ce qui change
3. Presenter les arguments POUR et CONTRE avec le meme poids et la meme longueur
4. Ne PAS rassurer le lecteur - c'est du parti-pris
5. Ne PAS utiliser de formulations qui prennent parti : "renforcer la lutte contre" (= c'est bien). Preferer : "augmenter les controles sur..."
6. Vote ADOPTE : "cette mesure entre en vigueur" / "cela signifie que..."
7. Vote REJETE : "cette mesure n'a pas ete retenue" / "le texte initial est maintenu"
8. Traduire TOUT le jargon parlementaire en francais courant
9. JAMAIS inventer de mesures concretes absentes des donnees fournies
10. Si les donnees sont trop minces pour identifier un impact citoyen : confidence < 40
11. Votes purement proceduraux : confidence < 40
12. Ne PAS commencer par "Ce vote..." - varier les accroches
13. Si le scrutin porte sur un amendement, expliquer DANS LE CONTEXTE DE LA LOI ce que l'amendement proposait de modifier

VULGARISATION - REGLES CRITIQUES :
14. JAMAIS referencer un numero d'article seul - TOUJOURS expliquer en langage courant le sujet
15. JAMAIS utiliser de termes techniques sans les expliquer
16. Commencer par poser le CONTEXTE concret avant d'entrer dans le detail
17. JAMAIS briser le 4e mur ("sans avoir le contenu exact", "les informations disponibles"). Si tu ne sais pas, confidence < 40
18. Si le titre mentionne un "projet de loi relatif a X", expliquer ce que X signifie concretement`;

// ============================================
// MAIN FUNCTION
// ============================================

export async function generateCitizenImpact(
  input: CitizenImpactInput,
  model?: string
): Promise<CitizenImpactOutput> {
  const userMessage = buildUserMessage(input);

  const response = await callAnthropic([{ role: "user", content: userMessage }], {
    model: model || HAIKU_MODEL,
    maxTokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [CITIZEN_IMPACT_TOOL],
    toolChoice: { type: "tool", name: "explain_citizen_impact" },
  });

  const output = extractToolUse(response) as {
    citizen_impact: string;
    confidence: number;
  } | null;

  if (!output) {
    return { citizenImpact: "", confidence: 0 };
  }

  return {
    citizenImpact: sanitizeOutput(output.citizen_impact),
    confidence: output.confidence ?? 0,
  };
}

export { SONNET_MODEL, HAIKU_MODEL };

// ============================================
// HELPERS
// ============================================

/**
 * Post-process AI output to fix common hallucination patterns:
 * 1. https:// prefix on relative links: https://assemblee/slug -> /assemblee/slug
 * 2. Double parentheses on markdown links: ((/path)) -> (/path)
 */
function sanitizeOutput(text: string): string {
  let result = text;
  result = result.replace(/https?:\/\/(assemblee|votes|partis|elections|politiques)\//g, "/$1/");
  result = result.replace(/\]\(\((\/.+?)\)\)/g, "]($1)");
  return result;
}

function buildUserMessage(input: CitizenImpactInput): string {
  const sections: string[] = [];

  sections.push(`SCRUTIN : ${input.title}`);
  sections.push(
    `Resultat : ${input.result === "ADOPTED" ? "ADOPTE" : "REJETE"} (${input.votesFor} pour, ${input.votesAgainst} contre, ${input.votesAbstain} abstentions)`
  );
  sections.push(`Chambre : ${input.chamber === "AN" ? "Assemblee nationale" : "Senat"}`);
  sections.push(`Date : ${input.votingDate}`);
  if (input.theme) sections.push(`Theme : ${input.theme}`);

  if (input.summary) {
    sections.push("");
    sections.push(`RESUME EXISTANT :`);
    sections.push(input.summary);
  }

  if (input.dossierTitle || input.dossierSummary) {
    sections.push("");
    sections.push("DOSSIER LEGISLATIF :");
    if (input.dossierTitle) sections.push(`Titre : ${input.dossierTitle}`);
    if (input.dossierSummary) sections.push(`Resume : ${input.dossierSummary}`);
  }

  if (input.sourcePageText) {
    sections.push("");
    sections.push("CONTENU DE LA PAGE SOURCE :");
    sections.push(input.sourcePageText);
  }

  const linkLines: string[] = [];
  if (input.links.dossierUrl) {
    linkLines.push(`Dossier legislatif : [${input.links.dossierLabel}](${input.links.dossierUrl})`);
  }
  for (const v of input.links.relatedVotes) {
    linkLines.push(`Vote lie : [${v.label}](${v.url})`);
  }
  for (const p of input.links.politicians) {
    linkLines.push(`Depute (${p.position}) : [${p.label}](${p.url})`);
  }
  if (linkLines.length > 0) {
    sections.push("");
    sections.push("LIENS DISPONIBLES (a inserer dans l'explication quand pertinent) :");
    sections.push(...linkLines);
  }

  return sections.join("\n");
}
