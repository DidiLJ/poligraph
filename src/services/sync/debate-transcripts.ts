import { db } from "@/lib/db";
import * as https from "https";
import { mkdirSync, rmSync, readdirSync, readFileSync, createWriteStream } from "fs";
import { execSync } from "child_process";

const LEGISLATURE = 17;
const TEMP_DIR = "/tmp/debate-transcripts";
const CR_ZIP_URL = `https://data.assemblee-nationale.fr/static/openData/repository/${LEGISLATURE}/debats/compteRendu/Comptes_Rendus.json.zip`;

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
    await downloadFile(CR_ZIP_URL, zipPath);
  } catch (e) {
    return { downloaded: 0, linked: 0, errors: [`Download failed: ${e}`] };
  }

  try {
    execSync(`unzip -o -q "${zipPath}" -d "${TEMP_DIR}/extracted"`, {
      timeout: 60000,
    });
  } catch (e) {
    return { downloaded: 0, linked: 0, errors: [`Unzip failed: ${e}`] };
  }

  const jsonDir = `${TEMP_DIR}/extracted`;
  let files: string[] = [];
  try {
    const walk = (dir: string): string[] => {
      const entries = readdirSync(dir, { withFileTypes: true });
      const results: string[] = [];
      for (const e of entries) {
        const full = `${dir}/${e.name}`;
        if (e.isDirectory()) results.push(...walk(full));
        else if (e.name.endsWith(".json")) results.push(full);
      }
      return results;
    };
    files = walk(jsonDir);
  } catch {
    // ignore
  }

  let downloaded = 0;
  let linked = 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  for (const file of files) {
    try {
      const raw = readFileSync(file, "utf-8");
      const json = JSON.parse(raw);
      const extracted = extractRelevantContent(json);
      if (!extracted) continue;

      const date = new Date(extracted.date);
      if (date < cutoff) continue;

      const existing = await db.debateTranscript.findFirst({
        where: { seanceRef: extracted.seanceRef },
      });

      if (existing) continue;

      await db.debateTranscript.create({
        data: {
          seanceRef: extracted.seanceRef,
          date,
          content: extracted.content,
          sourceUrl: extracted.sourceUrl,
        },
      });
      downloaded++;

      const scrutin = await db.scrutin.findFirst({
        where: {
          OR: [{ externalId: { contains: extracted.seanceRef } }],
        },
        select: { id: true },
      });

      if (scrutin) {
        await db.debateTranscript.updateMany({
          where: { seanceRef: extracted.seanceRef },
          data: { scrutinId: scrutin.id },
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
