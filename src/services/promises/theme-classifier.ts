import type { ThemeCategory } from "@/types";
import { THEME_RULES } from "./rules";
import { callAnthropic } from "@/lib/api/anthropic";

export interface ClassificationResult {
  theme: ThemeCategory;
  confidence: number;
  method: "rules" | "haiku";
}

const RULES_MIN_SCORE = 2;
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export function classifyByRules(text: string): ClassificationResult | null {
  const lower = text.toLowerCase();
  const scores = new Map<ThemeCategory, number>();
  for (const rule of THEME_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        scores.set(rule.theme, (scores.get(rule.theme) ?? 0) + rule.weight);
      }
    }
  }
  if (scores.size === 0) return null;
  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const [topTheme, topScore] = sorted[0]!;
  if (topScore < RULES_MIN_SCORE) return null;
  const secondScore = sorted[1]?.[1] ?? 0;
  const confidence = Math.min(0.95, 0.5 + (topScore - secondScore) * 0.1);
  return { theme: topTheme, confidence, method: "rules" };
}

const HAIKU_PROMPT = `Tu classes une déclaration politique française dans une des 13 catégories suivantes :
ECONOMIE_BUDGET, SOCIAL_TRAVAIL, SECURITE_JUSTICE, ENVIRONNEMENT_ENERGIE, SANTE,
EDUCATION_CULTURE, INSTITUTIONS, AFFAIRES_ETRANGERES_DEFENSE, NUMERIQUE_TECH,
IMMIGRATION, AGRICULTURE_ALIMENTATION, LOGEMENT_URBANISME, TRANSPORTS

Réponds STRICTEMENT au format JSON : {"theme": "<CATEGORIE>", "confidence": <0-1>}
Aucun texte hors JSON.

Déclaration à classer :
<text>{{TEXT}}</text>`;

export async function classifyByHaiku(text: string): Promise<ClassificationResult | null> {
  const safe = text.replace(/<\/?[a-z]+>/gi, "").slice(0, 1000);
  const prompt = HAIKU_PROMPT.replace("{{TEXT}}", safe);
  try {
    const response = await callAnthropic([{ role: "user", content: prompt }], {
      model: HAIKU_MODEL,
      maxTokens: 100,
    });
    const textBlock = response.content.find((c) => c.type === "text" && typeof c.text === "string");
    const raw = textBlock?.text ?? "";
    const match = raw.match(/\{[^}]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { theme?: string; confidence?: number };
    if (!parsed.theme) return null;
    const themes = THEME_RULES.map((r) => r.theme as string);
    if (!themes.includes(parsed.theme)) return null;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
    return {
      theme: parsed.theme as ThemeCategory,
      confidence: Math.min(1, Math.max(0, confidence)),
      method: "haiku",
    };
  } catch {
    return null;
  }
}

export async function classifyTheme(text: string): Promise<ClassificationResult> {
  const rules = classifyByRules(text);
  if (rules && rules.confidence >= 0.7) return rules;
  const haiku = await classifyByHaiku(text);
  if (haiku) return haiku;
  return rules ?? { theme: "INSTITUTIONS", confidence: 0.1, method: "rules" };
}
