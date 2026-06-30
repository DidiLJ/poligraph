/**
 * Robust file download with a per-attempt timeout and bounded retries.
 *
 * AN Open Data is regularly slow or unresponsive. A bare https.get() hangs
 * indefinitely and only a coarse orchestrator timeout (e.g. 10 min execSync)
 * kills it — leaving ETIMEDOUT at the worst possible granularity. This helper
 * caps each attempt and retries with backoff so both the CLI script and the
 * Inngest service share the same resilient behaviour.
 */

import * as fs from "fs";
import * as https from "https";
import { createWriteStream } from "fs";

const DEFAULT_TIMEOUT_MS = 120_000; // 120s per attempt
const DEFAULT_MAX_ATTEMPTS = 3;

function downloadOnce(url: string, dest: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    let settled = false;

    const cleanup = (err: Error) => {
      if (settled) return;
      settled = true;
      file.close();
      try {
        fs.unlinkSync(dest);
      } catch {
        // file may not exist yet
      }
      reject(err);
    };

    const req = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {
            // ignore
          }
          downloadOnce(redirectUrl, dest, timeoutMs).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        cleanup(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        if (settled) return;
        settled = true;
        file.close();
        resolve();
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms for ${url}`));
    });
    req.on("error", cleanup);
  });
}

/**
 * Download `url` to `dest`, retrying up to `maxAttempts` times with linear
 * backoff. Each attempt is capped at `timeoutMs`. Throws the last error if all
 * attempts fail.
 */
export async function downloadFileWithRetry(
  url: string,
  dest: string,
  opts: { timeoutMs?: number; maxAttempts?: number } = {}
): Promise<void> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxAttempts = DEFAULT_MAX_ATTEMPTS } = opts;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await downloadOnce(url, dest, timeoutMs);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const backoffMs = 2_000 * attempt;
        // eslint-disable-next-line no-console -- intentional operational retry log
        console.warn(
          `Download attempt ${attempt}/${maxAttempts} failed (${err instanceof Error ? err.message : String(err)}), retrying in ${backoffMs}ms...`
        );
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Download failed after ${maxAttempts} attempts`);
}
