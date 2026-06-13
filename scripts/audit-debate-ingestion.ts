/**
 * READ-ONLY before/after audit of the séance ingestion change.
 *
 * BEFORE = the #398 same-day audit on the current DB (transcripts truncated to
 *          5000 chars, candidates scoped by date).
 * AFTER  = the séance-scoped mapping computed from the FULL séance XML parsed
 *          locally (no DB write), counting how many séances of the day actually
 *          cite the voted amendment.
 *
 * Proves the truncation + same-day scoping were the bottleneck. NO DB write, NO
 * model call, NO backfill. The DB is read with explicit selects only and the full
 * `content` column is never loaded.
 *
 *   # uses a pre-extracted XML dir (fast):
 *   npx dotenv -e .env -- npx tsx scripts/audit-debate-ingestion.ts --xml /tmp/an-debate-diag/extracted
 *   # or let it download + extract the syseron zip itself:
 *   npx dotenv -e .env -- npx tsx scripts/audit-debate-ingestion.ts
 */
import { db } from "@/lib/db";
import * as https from "https";
import { mkdirSync, readdirSync, readFileSync, createWriteStream } from "fs";
import { extractZip } from "@/lib/parsing/unzip";
import { extractSeanceFromXml } from "@/services/sync/debate-transcript-parse";
import {
  findAmendmentMention,
  type AmendmentRef,
} from "@/services/scrutin-substance/debate-context";
import {
  auditKeyScrutinDebateMapping,
  extractAuthorSurname,
} from "@/services/scrutin-substance/debate-context-resolver";
import {
  classifyDebateMatchBySeance,
  type DebateMatchClass,
} from "@/services/scrutin-substance/debate-mapping";

const LEGISLATURE = 17;
const SYSERON_ZIP_URL = `https://data.assemblee-nationale.fr/static/openData/repository/${LEGISLATURE}/vp/syceronbrut/syseron.xml.zip`;
const SENTINEL_EXTERNAL_ID = "VTANR5L17V7183";

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const v = process.argv[i]!;
  return v.includes("=") ? v.split("=").slice(1).join("=") : process.argv[i + 1];
}

function log(line = ""): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https
      .get(url, (resp) => {
        if (resp.statusCode === 301 || resp.statusCode === 302) {
          const loc = resp.headers.location;
          if (loc) return downloadFile(loc, dest).then(resolve).catch(reject);
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

function walkXml(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walkXml(full));
    else if (e.name.endsWith(".xml")) out.push(full);
  }
  return out;
}

interface SeanceLite {
  seanceRef: string;
  content: string;
}

/** Parse every séance XML into a map dayISO -> séances (full content). */
function buildSeancesByDay(xmlDir: string): Map<string, SeanceLite[]> {
  const files = walkXml(xmlDir);
  const byDay = new Map<string, SeanceLite[]>();
  for (const f of files) {
    const s = extractSeanceFromXml(readFileSync(f, "utf-8"));
    if (!s) continue;
    const day = s.date.toISOString().slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push({ seanceRef: s.seanceRef, content: s.content });
    byDay.set(day, list);
  }
  return byDay;
}

/** Séance-scoped verdict for one scrutin against the full-content séances. */
function classifyAfter(
  refs: AmendmentRef[],
  seances: SeanceLite[]
): { matchClass: DebateMatchClass; mentioningHighCount: number; seanceCount: number } {
  let high = 0;
  let medium = 0;
  for (const s of seances) {
    const m = findAmendmentMention(s.content, refs);
    if (m.confidence === "HIGH") high++;
    else if (m.confidence === "MEDIUM") medium++;
  }
  const verdict = classifyDebateMatchBySeance({
    seanceCount: seances.length,
    mentioningHighCount: high,
    hasMedium: medium > 0,
  });
  return { matchClass: verdict.class, mentioningHighCount: high, seanceCount: seances.length };
}

async function main(): Promise<void> {
  let xmlDir = arg("xml");
  if (!xmlDir) {
    const tmp = "/tmp/audit-debate-ingestion";
    mkdirSync(tmp, { recursive: true });
    log("Téléchargement du syseron.xml.zip (≈50 Mo)…");
    await downloadFile(SYSERON_ZIP_URL, `${tmp}/syseron.xml.zip`);
    extractZip(`${tmp}/syseron.xml.zip`, `${tmp}/extracted`);
    xmlDir = `${tmp}/extracted`;
  }

  log(
    "=== Audit ingestion débats : AVANT (#398 same-day, tronqué) vs APRÈS (séance, complet) ===\n"
  );

  // BEFORE: #398 same-day audit on the current DB.
  const before = await auditKeyScrutinDebateMapping();
  const beforeClassById = new Map(before.rows.map((r) => [r.scrutinId, r.matchClass]));

  // Key votes with amendment + full refs (number/author/article), no content loaded.
  const scrutins = await db.scrutin.findMany({
    where: { importance: { isKeyVote: true }, amendmentLinks: { some: {} } },
    orderBy: { votingDate: "desc" },
    select: {
      id: true,
      externalId: true,
      slug: true,
      votingDate: true,
      amendmentLinks: {
        select: { amendment: { select: { number: true, authorName: true, article: true } } },
      },
    },
  });

  const seancesByDay = buildSeancesByDay(xmlDir);
  log(`séances XML parsées : ${[...seancesByDay.values()].reduce((n, l) => n + l.length, 0)}`);
  log(`jours couverts      : ${seancesByDay.size}\n`);

  const CLASSES: DebateMatchClass[] = ["matched", "ambiguous", "unsafe", "missing"];
  const beforeCount: Record<DebateMatchClass, number> = {
    matched: 0,
    ambiguous: 0,
    unsafe: 0,
    missing: 0,
  };
  const afterCount: Record<DebateMatchClass, number> = {
    matched: 0,
    ambiguous: 0,
    unsafe: 0,
    missing: 0,
  };
  const transitions = new Map<string, number>();
  let ambiguousToMatched = 0;
  let unsafeStaysUnsafe = 0;

  for (const s of scrutins) {
    const refs: AmendmentRef[] = s.amendmentLinks.map((l) => ({
      number: l.amendment.number,
      authorSurname: extractAuthorSurname(l.amendment.authorName),
      article: l.amendment.article,
    }));
    const day = s.votingDate.toISOString().slice(0, 10);
    const seances = seancesByDay.get(day) ?? [];
    const after = classifyAfter(refs, seances);
    const beforeClass = beforeClassById.get(s.id) ?? "missing";

    beforeCount[beforeClass]++;
    afterCount[after.matchClass]++;
    const key = `${beforeClass} -> ${after.matchClass}`;
    transitions.set(key, (transitions.get(key) ?? 0) + 1);
    if (beforeClass === "ambiguous" && after.matchClass === "matched") ambiguousToMatched++;
    if (beforeClass === "unsafe" && after.matchClass === "unsafe") unsafeStaysUnsafe++;
  }

  log(`scrutins audités (key votes + amendement) : ${scrutins.length}\n`);
  log("CLASSES                AVANT    APRÈS");
  for (const c of CLASSES) {
    log(
      `  ${c.padEnd(20)} ${String(beforeCount[c]).padStart(5)}   ${String(afterCount[c]).padStart(5)}`
    );
  }

  log("\nTRANSITIONS (avant -> après, !=)");
  for (const [k, n] of [...transitions.entries()].sort((a, b) => b[1] - a[1])) {
    if (k.split(" -> ")[0] !== k.split(" -> ")[1]) log(`  ${k.padEnd(26)} : ${n}`);
  }
  log(
    `\n  ambiguous -> matched  : ${ambiguousToMatched}  (ambiguïtés levées par le scoping séance)`
  );
  log(
    `  unsafe    -> unsafe   : ${unsafeStaysUnsafe}  (restent sans mention explicite, correctement)`
  );

  // 2084 sentinel.
  log(`\n── CAS SENTINELLE ${SENTINEL_EXTERNAL_ID} (amendement 2084) ──`);
  const sentinel = scrutins.find((s) => s.externalId === SENTINEL_EXTERNAL_ID);
  if (!sentinel) {
    log("  hors périmètre (pas key vote+amendement) ou introuvable.");
  } else {
    const refs: AmendmentRef[] = sentinel.amendmentLinks.map((l) => ({
      number: l.amendment.number,
      authorSurname: extractAuthorSurname(l.amendment.authorName),
      article: l.amendment.article,
    }));
    const day = sentinel.votingDate.toISOString().slice(0, 10);
    const seances = seancesByDay.get(day) ?? [];
    const after = classifyAfter(refs, seances);
    log(`  AVANT (tronqué) : ${beforeClassById.get(sentinel.id) ?? "missing"}`);
    log(
      `  APRÈS (complet) : ${after.matchClass}  (${after.mentioningHighCount} séance(s) citant 2084 / ${after.seanceCount} ce jour)`
    );
    log(
      after.matchClass === "matched"
        ? "  ✓ La levée de la troncature révèle la mention explicite de 2084 dans l'unique séance → matched."
        : "  ℹ 2084 reste " +
            after.matchClass +
            " (pas de mention explicite dans le contenu complet)."
    );
  }
  log("");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
