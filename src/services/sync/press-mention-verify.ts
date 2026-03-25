/**
 * AI-powered verification of press mention accuracy.
 *
 * After fullNameOnly matching detects politician mentions in press articles,
 * this service asks Mistral to confirm whether each mention truly refers to
 * the politician in our database (vs. a homonym or passing reference).
 *
 * Falls back silently to keeping all mentions if Mistral is unavailable.
 */

import { callMistral, extractMistralText, parseMistralJSON } from "@/lib/api/mistral";

interface MentionToVerify {
  politicianId: string;
  matchedName: string;
  /** Short description for AI context, e.g. "député du Cantal" */
  role: string;
}

interface VerifyInput {
  articleTitle: string;
  articleDescription: string;
  mentions: MentionToVerify[];
}

interface VerificationResult {
  politicianId: string;
  matchedName: string;
  confirmed: boolean;
}

const SYSTEM_PROMPT = `Tu es un vérificateur de mentions dans la presse française.

On te donne un article (titre + description) et une liste de politiciens détectés par correspondance de nom.

Pour chaque politicien, réponds si l'article parle VRAIMENT de cette personne (le politicien français) ou s'il s'agit d'un homonyme, d'une référence historique ou d'une mention hors contexte.

Réponds en JSON strict :
{ "results": [{ "name": "...", "confirmed": true/false }] }

Règles :
- confirmed = true si l'article parle bien du politicien indiqué
- confirmed = false si c'est un homonyme (ex: Patrick Bruel le chanteur vs Jérôme Bruel le député)
- confirmed = false si c'est une citation historique sans rapport avec l'actualité du politicien
- En cas de doute, confirmed = true (mieux vaut garder un lien que le perdre)`;

/**
 * Verify detected mentions using Mistral AI.
 * Returns only confirmed mentions. Falls back to all mentions on error.
 */
export async function verifyMentions(input: VerifyInput): Promise<VerificationResult[]> {
  if (input.mentions.length === 0) return [];

  const sanitize = (s: string) => s.replace(/["\n\r]/g, " ").slice(0, 300);

  const mentionLines = input.mentions.map((m) => `- ${m.matchedName} (${m.role})`).join("\n");

  const userMessage = `<article>
<titre>${sanitize(input.articleTitle)}</titre>
<description>${sanitize(input.articleDescription)}</description>
</article>

<politiciens_detectes>
${mentionLines}
</politiciens_detectes>`;

  try {
    const response = await callMistral([{ role: "user", content: userMessage }], {
      model: "mistral-small-latest",
      system: SYSTEM_PROMPT,
      maxTokens: 200,
      temperature: 0,
      responseFormat: { type: "json_object" },
    });

    const text = extractMistralText(response);
    const parsed = parseMistralJSON<{ results: Array<{ name: string; confirmed: boolean }> }>(text);

    if (!Array.isArray(parsed.results)) {
      return input.mentions.map((m) => ({
        politicianId: m.politicianId,
        matchedName: m.matchedName,
        confirmed: true,
      }));
    }

    // Map AI results back to mentions by name
    return input.mentions.map((m) => {
      const aiResult = parsed.results.find(
        (r) => r.name.toLowerCase() === m.matchedName.toLowerCase()
      );
      return {
        politicianId: m.politicianId,
        matchedName: m.matchedName,
        // Default to confirmed if AI didn't return a result for this name
        confirmed: aiResult?.confirmed ?? true,
      };
    });
  } catch {
    // Fallback: keep all mentions if Mistral is unavailable
    return input.mentions.map((m) => ({
      politicianId: m.politicianId,
      matchedName: m.matchedName,
      confirmed: true,
    }));
  }
}
