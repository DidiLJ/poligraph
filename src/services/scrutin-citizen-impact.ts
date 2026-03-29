/**
 * AI generation of citizen-facing impact explanations for parliamentary votes.
 *
 * Uses Mistral (French-optimized) to generate "Ce que ca change pour vous"
 * explanations that translate procedural parliamentary language into
 * structured, scannable plain French for citizens.
 */

import { callMistral, extractMistralText, parseMistralJSON } from "@/lib/api/mistral";

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

const SYSTEM_PROMPT = `Tu es un rédacteur factuel pour Poligraph, un observatoire citoyen de la politique française.

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

function buildUserMessage(input: CitizenImpactInput): string {
  const sections: string[] = [];

  sections.push(`SCRUTIN : ${input.title}`);
  sections.push(
    `Résultat : ${input.result === "ADOPTED" ? "ADOPTÉ" : "REJETÉ"} (${input.votesFor} pour, ${input.votesAgainst} contre, ${input.votesAbstain} abstentions)`
  );
  sections.push(`Chambre : ${input.chamber === "AN" ? "Assemblée nationale" : "Sénat"}`);
  sections.push(`Date : ${input.votingDate}`);
  if (input.theme) sections.push(`Thème : ${input.theme}`);

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
