// Compte rendu intégral Assemblée nationale (CRI AN)
// Q4 2026 prototype: skeleton parser, validates fetch + parse on a single séance.
// Production pipeline + Inngest cron deferred to Q1 2027.
//
// Schema reference (observed on legislature 17 samples, May 2026):
//   <compteRendu xmlns="http://schemas.assemblee-nationale.fr/referentiel">
//     <metadonnees>...</metadonnees>
//     <sommaire>...</sommaire>
//     <contenu>
//       <ouvertureSeance>
//         <paragraphe id_acteur="PA..." ...>
//           <orateurs>
//             <orateur><nom>...</nom><id>...</id><qualite/></orateur>
//           </orateurs>
//           <texte stime="926.62">La séance est ouverte.</texte>
//         </paragraphe>
//         ...
//       </ouvertureSeance>
//       <point>... nested <paragraphe> ...</point>
//     </contenu>
//   </compteRendu>
//
// The dataset is published under Licence Ouverte (Etalab).

import { XMLParser } from "fast-xml-parser";

export interface CriIntervention {
  speakerName: string;
  speakerId?: string;
  text: string;
  timestamp?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // Keep text content together when a node has mixed children (e.g. <texte>… <italique>…</italique></texte>).
  textNodeName: "#text",
});

export async function fetchCriSeance(seanceUrl: string): Promise<CriIntervention[]> {
  const response = await fetch(seanceUrl, {
    headers: { Accept: "application/xml" },
  });
  if (!response.ok) {
    throw new Error(`CRI fetch failed: ${response.status} ${response.statusText}`);
  }
  const xml = await response.text();
  return parseCriXml(xml);
}

export function parseCriXml(xml: string): CriIntervention[] {
  if (!xml || xml.trim().length === 0) return [];

  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return [];
  }

  const paragraphes: unknown[] = [];
  collectByKey(parsed, "paragraphe", paragraphes);

  const interventions: CriIntervention[] = [];
  for (const p of paragraphes) {
    const intervention = extractIntervention(p);
    if (intervention) interventions.push(intervention);
  }
  return interventions;
}

function extractIntervention(node: unknown): CriIntervention | null {
  if (!isRecord(node)) return null;

  const orateur = pickFirstOrateur(node);
  const speakerName = orateur ? toCleanString(orateur.nom) : "";
  if (!speakerName) return null;

  const text = extractTexte(node.texte);
  if (!text) return null;

  const speakerId = orateur ? toCleanString(orateur.id) : "";
  const timestamp = extractStime(node.texte);

  return {
    speakerName,
    ...(speakerId ? { speakerId } : {}),
    text,
    ...(timestamp ? { timestamp } : {}),
  };
}

function pickFirstOrateur(paragraphe: Record<string, unknown>): Record<string, unknown> | null {
  const orateurs = paragraphe.orateurs;
  if (!isRecord(orateurs)) return null;
  const orateur = orateurs.orateur;
  if (Array.isArray(orateur)) {
    return isRecord(orateur[0]) ? orateur[0] : null;
  }
  return isRecord(orateur) ? orateur : null;
}

function extractTexte(texte: unknown): string {
  if (texte == null) return "";
  if (typeof texte === "string") return texte.trim();
  if (typeof texte === "number") return String(texte);
  if (Array.isArray(texte)) {
    return texte
      .map((t) => extractTexte(t))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (isRecord(texte)) {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(texte)) {
      if (key.startsWith("@_")) continue;
      if (key === "#text") {
        const s = typeof value === "string" ? value : String(value ?? "");
        if (s.trim()) parts.push(s.trim());
        continue;
      }
      const nested = extractTexte(value);
      if (nested) parts.push(nested);
    }
    return parts.join(" ").trim();
  }
  return "";
}

function extractStime(texte: unknown): string | undefined {
  if (!isRecord(texte)) return undefined;
  const stime = texte["@_stime"];
  if (stime == null) return undefined;
  const s = typeof stime === "string" ? stime : String(stime);
  return s.length > 0 ? s : undefined;
}

function collectByKey(node: unknown, key: string, out: unknown[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectByKey(item, key, out);
    return;
  }
  if (!isRecord(node)) return;
  for (const [k, v] of Object.entries(node)) {
    if (k === key) {
      if (Array.isArray(v)) out.push(...v);
      else out.push(v);
    }
    if (typeof v === "object" && v !== null) {
      collectByKey(v, key, out);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCleanString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (isRecord(value)) {
    const inner = value["#text"];
    if (typeof inner === "string") return inner.trim();
  }
  return "";
}

// Confirmed working URL during Q4 2026 timeboxed discovery (séance du 13 mai 2026).
// Production pipeline (Q1 2027) will enumerate via the syseron.xml.zip bulk archive:
//   https://data.assemblee-nationale.fr/static/openData/repository/17/vp/syceronbrut/syseron.xml.zip
// or by listing /dyn/{leg}/comptes-rendus/seance and resolving each séance's
// /dyn/opendata/CRSANR5L{leg}S{year}O{session}N{numSeance}.xml file.
export const CRI_AN_DEMO_URL =
  "https://www.assemblee-nationale.fr/dyn/opendata/CRSANR5L17S2026O1N232.xml";
