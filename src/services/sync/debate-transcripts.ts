import { db } from "@/lib/db";
import * as https from "https";
import { mkdirSync, rmSync, readdirSync, readFileSync, createWriteStream } from "fs";
import { execSync } from "child_process";

const LEGISLATURE = 17;
const TEMP_DIR = "/tmp/debate-transcripts";
const SYSERON_ZIP_URL = `https://data.assemblee-nationale.fr/static/openData/repository/${LEGISLATURE}/vp/syceronbrut/syseron.xml.zip`;

interface SyncResult {
  downloaded: number;
  linked: number;
  errors: string[];
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https
      .get(url, (resp) => {
        if (resp.statusCode === 301 || resp.statusCode === 302) {
          const location = resp.headers.location;
          if (location) {
            downloadFile(location, dest).then(resolve).catch(reject);
            return;
          }
        }
        resp.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", reject);
  });
}

function extractTextContent(xml: string): string {
  return xml
    .replace(/<italique>/g, "")
    .replace(/<\/italique>/g, "")
    .replace(/<br\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractRelevantContentXml(xml: string): {
  seanceRef: string;
  date: string;
  content: string;
  sourceUrl: string | null;
} | null {
  try {
    const uidMatch = xml.match(/<uid>([^<]+)<\/uid>/);
    const seanceRefMatch = xml.match(/<seanceRef>([^<]+)<\/seanceRef>/);
    const dateMatch = xml.match(/<dateSeance>(\d{8})/);
    if (!uidMatch || !dateMatch) return null;

    const uid = uidMatch[1]!;
    const seanceRef = seanceRefMatch?.[1] ?? uid;
    const dateStr = dateMatch[1]!;
    const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

    // Extract all <texte> content from paragraphes with speaker roles
    const texts: string[] = [];
    const paragrapheRegex = /<paragraphe[^>]*roledebat="[^"]*"[^>]*>[\s\S]*?<\/paragraphe>/g;
    let match;
    while ((match = paragrapheRegex.exec(xml)) !== null) {
      const block = match[0];
      const nameMatch = block.match(/<nom>([^<]+)<\/nom>/);
      const texteMatch = block.match(/<texte[^>]*>([\s\S]*?)<\/texte>/);
      if (texteMatch) {
        const speaker = nameMatch ? `${nameMatch[1]} : ` : "";
        const text = extractTextContent(texteMatch[1]!);
        if (text && text.length > 20) {
          texts.push(speaker + text);
        }
      }
    }

    const content = texts.join("\n\n").slice(0, 5000);
    if (!content) return null;

    return {
      seanceRef,
      date,
      content,
      sourceUrl: `https://www.assemblee-nationale.fr/dyn/${LEGISLATURE}/comptes-rendus/seance/${uid}`,
    };
  } catch {
    return null;
  }
}

// Keep old JSON extractor for backwards compatibility
export function extractRelevantContent(crJson: Record<string, unknown>): {
  seanceRef: string;
  date: string;
  content: string;
  sourceUrl: string | null;
} | null {
  try {
    const cr = crJson as {
      compteRendu?: {
        uid?: string;
        dateSeanceJour?: string;
        contenu?: {
          pointsOdj?: {
            pointOdj?: Array<{
              interventions?: {
                intervention?: Array<{ texte?: string }> | { texte?: string };
              };
            }>;
          };
        };
      };
    };

    const uid = cr.compteRendu?.uid;
    const date = cr.compteRendu?.dateSeanceJour;
    if (!uid || !date) return null;

    const points = cr.compteRendu?.contenu?.pointsOdj?.pointOdj;
    if (!points || !Array.isArray(points)) return null;

    const texts: string[] = [];
    for (const point of points) {
      const interventions = point.interventions?.intervention;
      if (!interventions) continue;
      const arr = Array.isArray(interventions) ? interventions : [interventions];
      for (const interv of arr) {
        if (interv.texte) texts.push(interv.texte);
      }
    }

    const content = texts.join("\n\n").slice(0, 5000);
    if (!content) return null;

    return {
      seanceRef: uid,
      date,
      content,
      sourceUrl: `https://www.assemblee-nationale.fr/dyn/${LEGISLATURE}/comptes-rendus/seance/${uid}`,
    };
  } catch {
    return null;
  }
}

export async function syncDebateTranscripts(): Promise<SyncResult> {
  const errors: string[] = [];

  mkdirSync(TEMP_DIR, { recursive: true });
  const zipPath = `${TEMP_DIR}/cr.zip`;

  try {
    await downloadFile(SYSERON_ZIP_URL, zipPath);
  } catch (e) {
    return { downloaded: 0, linked: 0, errors: [`Download failed: ${e}`] };
  }

  try {
    execSync(`unzip -o -q "${zipPath}" -d "${TEMP_DIR}/extracted"`, {
      timeout: 120000,
    });
  } catch (e) {
    return { downloaded: 0, linked: 0, errors: [`Unzip failed: ${e}`] };
  }

  const extractDir = `${TEMP_DIR}/extracted`;
  let files: string[] = [];
  try {
    const walk = (dir: string): string[] => {
      const entries = readdirSync(dir, { withFileTypes: true });
      const results: string[] = [];
      for (const e of entries) {
        const full = `${dir}/${e.name}`;
        if (e.isDirectory()) results.push(...walk(full));
        else if (e.name.endsWith(".xml")) results.push(full);
      }
      return results;
    };
    files = walk(extractDir);
  } catch {
    // ignore
  }

  let downloaded = 0;
  let linked = 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  // Pre-load existing seanceRefs to avoid N+1 queries
  const existingRefs = new Set(
    (
      await db.debateTranscript.findMany({
        select: { seanceRef: true },
      })
    ).map((t) => t.seanceRef)
  );

  for (const file of files) {
    try {
      const raw = readFileSync(file, "utf-8");
      const extracted = file.endsWith(".xml")
        ? extractRelevantContentXml(raw)
        : extractRelevantContent(JSON.parse(raw));
      if (!extracted) continue;

      const date = new Date(extracted.date);
      if (date < cutoff) continue;

      if (existingRefs.has(extracted.seanceRef)) continue;

      await db.debateTranscript.create({
        data: {
          seanceRef: extracted.seanceRef,
          date,
          content: extracted.content,
          sourceUrl: extracted.sourceUrl,
        },
      });
      existingRefs.add(extracted.seanceRef);
      downloaded++;

      // Link to scrutin by matching date
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const scrutins = await db.scrutin.findMany({
        where: {
          chamber: "AN",
          votingDate: { gte: dayStart, lte: dayEnd },
          debateTranscripts: { none: {} },
        },
        select: { id: true },
      });

      if (scrutins.length > 0 && scrutins[0]) {
        await db.debateTranscript.updateMany({
          where: { seanceRef: extracted.seanceRef },
          data: { scrutinId: scrutins[0].id },
        });
        linked++;
      }
    } catch (e) {
      errors.push(`Error processing ${file}: ${e}`);
    }
  }

  rmSync(TEMP_DIR, { recursive: true, force: true });

  return { downloaded, linked, errors: errors.slice(0, 10) };
}
