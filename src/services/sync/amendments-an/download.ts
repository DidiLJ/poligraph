import { createWriteStream, existsSync, statSync, unlinkSync } from "fs";
import https from "https";

export const AMENDMENTS_ZIP_URL =
  "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/amendements_div_legis/Amendements.json.zip";

export interface DownloadResult {
  etag?: string;
  lastModified?: string;
  bytes: number;
  notModified?: boolean;
}

/**
 * Downloads the amendments ZIP over HTTP/1.1 (Node https default) with bounded
 * retries. Verifies the downloaded size against Content-Length. Honors etag via
 * If-None-Match (304 -> notModified). On failure: delete the partial file and
 * full-re-download on the next attempt - this is NOT byte-range resume. The
 * file is only considered good once its size matches Content-Length.
 */
export async function downloadAmendmentsZip(
  dest: string,
  opts: { etag?: string | null; maxRetries?: number; url?: string } = {}
): Promise<DownloadResult> {
  const url = opts.url ?? AMENDMENTS_ZIP_URL;
  const maxRetries = opts.maxRetries ?? 4;
  let lastErr: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await attemptDownload(url, dest, opts.etag ?? null);
    } catch (err) {
      lastErr = err as Error;
      if (existsSync(dest)) unlinkSync(dest);
      const backoff = Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw new Error(`downloadAmendmentsZip failed after ${maxRetries} attempts: ${lastErr?.message}`);
}

function attemptDownload(url: string, dest: string, etag: string | null): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers: Record<string, string> = {};
    if (etag) headers["If-None-Match"] = etag;

    https
      .get({ hostname: u.hostname, path: u.pathname + u.search, headers }, (res) => {
        if (res.statusCode === 304) {
          res.resume();
          return resolve({ etag: etag ?? undefined, bytes: 0, notModified: true });
        }
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          res.resume();
          if (!loc) return reject(new Error("redirect without location"));
          return attemptDownload(loc, dest, etag).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const expected = Number(res.headers["content-length"] ?? 0);
        const file = createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            const got = statSync(dest).size;
            if (expected > 0 && got !== expected) {
              return reject(new Error(`size mismatch: got ${got}, expected ${expected}`));
            }
            resolve({
              etag: res.headers.etag,
              lastModified: res.headers["last-modified"],
              bytes: got,
            });
          });
        });
        file.on("error", reject);
        res.on("error", reject);
      })
      .on("error", reject);
  });
}
