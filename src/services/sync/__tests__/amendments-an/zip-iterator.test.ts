import { describe, it, expect } from "vitest";
import { join } from "path";
import {
  iterateZipJsonEntries,
  dossierRefFromEntryPath,
  texteRefFromEntryPath,
} from "@/services/sync/amendments-an/zip-iterator";

const TINY = join(__dirname, "fixtures", "tiny.zip");

describe("iterateZipJsonEntries", () => {
  it("yields each .json entry with its path and parsed content, bounded memory", async () => {
    const seen: { path: string; uid: string }[] = [];
    for await (const entry of iterateZipJsonEntries(TINY)) {
      const j = entry.json as { amendement: { uid: string } };
      seen.push({ path: entry.entryPath, uid: j.amendement.uid });
    }
    expect(seen).toHaveLength(2);
    expect(seen.map((s) => s.uid).sort()).toEqual(["A1", "A2"]);
    expect(seen[0]!.path).toContain("DLR5L17N54083");
  });

  it("respects a limit", async () => {
    let count = 0;
    for await (const _ of iterateZipJsonEntries(TINY, { limit: 1 })) count++;
    expect(count).toBe(1);
  });

  it("invokes onWarning on unparseable JSON entries instead of silently skipping", async () => {
    const yazl = await import("yazl");
    const { mkdtempSync, writeFileSync } = await import("fs");
    const tmp = mkdtempSync("/tmp/itzip-");
    const zp = `${tmp}/mixed.zip`;

    const zf = new yazl.ZipFile();
    zf.addBuffer(
      Buffer.from('{"amendement":{"uid":"OK","identification":{"numeroLong":"1"}}}'),
      "json/DLR_X/PIONANR_Y/OK.json"
    );
    zf.addBuffer(Buffer.from("not-json"), "json/DLR_X/PIONANR_Y/BAD.json");
    zf.end();

    await new Promise<void>((res, rej) => {
      const chunks: Buffer[] = [];
      zf.outputStream.on("data", (c) => chunks.push(c as Buffer));
      zf.outputStream.on("end", () => {
        writeFileSync(zp, Buffer.concat(chunks));
        res();
      });
      zf.outputStream.on("error", rej);
    });

    const warnings: { entryPath: string; error: string }[] = [];
    let ok = 0;
    for await (const _ of iterateZipJsonEntries(zp, { onWarning: (w) => warnings.push(w) })) ok++;
    expect(ok).toBe(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.entryPath).toContain("BAD.json");
  });

  it("throws when onWarning is not provided and an entry is unparseable", async () => {
    const yazl = await import("yazl");
    const { mkdtempSync, writeFileSync } = await import("fs");
    const tmp = mkdtempSync("/tmp/itzip-");
    const zp = `${tmp}/bad.zip`;

    const zf = new yazl.ZipFile();
    zf.addBuffer(Buffer.from("not-json"), "json/DLR_X/PIONANR_Y/BAD.json");
    zf.end();

    await new Promise<void>((res, rej) => {
      const chunks: Buffer[] = [];
      zf.outputStream.on("data", (c) => chunks.push(c as Buffer));
      zf.outputStream.on("end", () => {
        writeFileSync(zp, Buffer.concat(chunks));
        res();
      });
      zf.outputStream.on("error", rej);
    });

    await expect(async () => {
      for await (const _ of iterateZipJsonEntries(zp)) {
        /* no-op */
      }
    }).rejects.toThrow(/Unparseable JSON/);
  });
});

describe("texteRefFromEntryPath / dossierRefFromEntryPath", () => {
  it("extracts the PIONANR texteRef from the entry path", () => {
    const p = "json/DLR5L17N54083/PIONANR5L17B1432/AMANR_X.json";
    expect(dossierRefFromEntryPath(p)).toBe("DLR5L17N54083");
    expect(texteRefFromEntryPath(p)).toBe("PIONANR5L17B1432");
  });

  it("returns null when the path has no DLR / PIONANR segment", () => {
    expect(dossierRefFromEntryPath("json/A/B/x.json")).toBeNull();
    expect(texteRefFromEntryPath("json/A/B/x.json")).toBeNull();
  });
});
