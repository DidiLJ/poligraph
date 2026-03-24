import { db } from "@/lib/db";
import { callMistral, extractMistralText, parseMistralJSON } from "@/lib/api/mistral";

interface GroupPositionInput {
  groupName: string;
  position: string;
  forCount: number;
  againstCount: number;
  abstainCount: number;
}

interface PromptInput {
  title: string;
  result: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  groupPositions: GroupPositionInput[];
  debateExcerpt: string | null;
  dossierContext: string | null;
}

interface AnalysisOutput {
  argumentsFor: string;
  argumentsAgainst: string;
}

const BANNED_ADJECTIVES = [
  "raisonnable",
  "courageux",
  "courageuse",
  "dangereux",
  "dangereuse",
  "irresponsable",
  "brillant",
  "brillante",
  "absurde",
  "ridicule",
  "exemplaire",
  "scandaleux",
  "scandaleuse",
  "admirable",
];

export function buildAnalysisPrompt(input: PromptInput): string {
  const sanitize = (s: string) => s.replace(/["\n\r]/g, " ").slice(0, 500);

  const groupLines = input.groupPositions
    .map(
      (g) =>
        `- ${sanitize(g.groupName)}: ${g.position} (${g.forCount} pour, ${g.againstCount} contre, ${g.abstainCount} abstentions)`
    )
    .join("\n");

  return `<données>
<scrutin>
<titre>${sanitize(input.title)}</titre>
<résultat>${input.result}</résultat>
<votes>Pour: ${input.votesFor}, Contre: ${input.votesAgainst}, Abstention: ${input.votesAbstain}</votes>
</scrutin>

<positions_groupes>
${groupLines}
</positions_groupes>

${input.debateExcerpt ? `<débat>\n${input.debateExcerpt.slice(0, 3000)}\n</débat>` : ""}
${input.dossierContext ? `<dossier>\n${sanitize(input.dossierContext)}\n</dossier>` : ""}
</données>

Analyse ce scrutin parlementaire. Produis un JSON avec deux champs :
- "argumentsFor": les arguments des groupes ayant voté POUR (2-3 phrases max)
- "argumentsAgainst": les arguments des groupes ayant voté CONTRE (2-3 phrases max)

Règles strictes :
1. Neutralité absolue : présente chaque camp avec un poids égal. Jamais de qualificatif de valeur.
2. Vulgarisation avec sources : explique d'abord en français simple, puis cite la référence de l'article entre parenthèses si disponible.
3. Complétude : couvre TOUS les camps, y compris les positions minoritaires qui ont rompu avec leur alliance habituelle.
4. Fidélité aux sources : utilise UNIQUEMENT les arguments réellement exprimés dans les débats fournis. Si le débat est insuffisant, dis-le plutôt que d'inventer.
5. Concision : chaque argument en 2-3 phrases maximum. Pas de remplissage, pas de répétition.
6. Pas de statistiques dans le texte : les chiffres sont affichés par l'interface.
7. Vérifiabilité : chaque affirmation doit être traçable au débat ou au texte législatif fourni.

Réponds UNIQUEMENT avec le JSON, sans markdown.`;
}

export function validateAnalysisOutput(output: AnalysisOutput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const combined = `${output.argumentsFor} ${output.argumentsAgainst}`.toLowerCase();

  for (const adj of BANNED_ADJECTIVES) {
    if (combined.includes(adj)) {
      errors.push("neutrality");
      break;
    }
  }

  if (output.argumentsFor.length > 500 || output.argumentsAgainst.length > 500) {
    errors.push("conciseness");
  }

  if (!output.argumentsFor.trim() || !output.argumentsAgainst.trim()) {
    errors.push("completeness");
  }

  return { valid: errors.length === 0, errors };
}

export async function generateScrutinAnalysis(
  options: {
    limit?: number;
    force?: boolean;
  } = {}
): Promise<{ generated: number; skipped: number; errors: string[] }> {
  const { limit = 10, force = false } = options;
  const errors: string[] = [];

  const where = force
    ? { importance: { isKeyVote: true } }
    : { importance: { isKeyVote: true }, analysis: null };

  const scrutins = await db.scrutin.findMany({
    where,
    take: limit,
    orderBy: { votingDate: "desc" },
    select: {
      id: true,
      title: true,
      result: true,
      votesFor: true,
      votesAgainst: true,
      votesAbstain: true,
      groupPositions: {
        include: { group: { select: { name: true, code: true } } },
      },
      debateTranscripts: {
        take: 1,
        orderBy: { date: "desc" },
        select: { content: true },
      },
      dossierLegislatif: {
        select: { title: true },
      },
    },
  });

  let generated = 0;
  let skipped = 0;

  for (const s of scrutins) {
    try {
      const prompt = buildAnalysisPrompt({
        title: s.title,
        result: s.result,
        votesFor: s.votesFor,
        votesAgainst: s.votesAgainst,
        votesAbstain: s.votesAbstain,
        groupPositions: s.groupPositions.map((gp) => ({
          groupName: gp.group.name,
          position: gp.position,
          forCount: gp.forCount,
          againstCount: gp.againstCount,
          abstainCount: gp.abstainCount,
        })),
        debateExcerpt: s.debateTranscripts[0]?.content ?? null,
        dossierContext: s.dossierLegislatif?.title ?? null,
      });

      const response = await callMistral([{ role: "user", content: prompt }], {
        model: "mistral-large-latest",
        maxTokens: 1000,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
      });

      const text = extractMistralText(response);
      const parsed = parseMistralJSON<AnalysisOutput>(text);
      const validation = validateAnalysisOutput(parsed);

      if (!validation.valid) {
        errors.push(`${s.id}: validation failed (${validation.errors.join(", ")})`);
        skipped++;
        continue;
      }

      const sourceType =
        s.debateTranscripts.length > 0
          ? ("DEBATE_TRANSCRIPT" as const)
          : ("STRUCTURED_DATA" as const);

      await db.scrutinAnalysis.upsert({
        where: { scrutinId: s.id },
        create: {
          scrutinId: s.id,
          argumentsFor: parsed.argumentsFor,
          argumentsAgainst: parsed.argumentsAgainst,
          sourceType,
          modelVersion: "mistral-large-latest",
        },
        update: {
          argumentsFor: parsed.argumentsFor,
          argumentsAgainst: parsed.argumentsAgainst,
          sourceType,
          modelVersion: "mistral-large-latest",
        },
      });

      generated++;
    } catch (e) {
      errors.push(`${s.id}: ${e instanceof Error ? e.message : String(e)}`);
      skipped++;
    }
  }

  return { generated, skipped, errors: errors.slice(0, 20) };
}
