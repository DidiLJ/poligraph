import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SOURCE = resolve(process.cwd(), "public/logo.png");
const SIZES = [192, 512] as const;

async function main() {
  for (const size of SIZES) {
    const buffer = await sharp(SOURCE)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 38, b: 84, alpha: 1 },
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    const out = resolve(process.cwd(), `public/icon-${size}.png`);
    await writeFile(out, buffer);
    console.log(`Wrote ${out} (${buffer.byteLength} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
