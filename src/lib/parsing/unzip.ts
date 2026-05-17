import AdmZip from "adm-zip";

// Vercel's serverless runtime ships no `unzip` binary, so `execSync("unzip ...")`
// fails with "command not found". This wrapper provides the same overwrite-all
// semantics using a pure-JS implementation that works in every environment.
export function extractZip(zipPath: string, outputDir: string): void {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(outputDir, true);
}
