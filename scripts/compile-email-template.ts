/**
 * Pre-compiles MJML email templates to HTML for Vercel serverless compatibility.
 *
 * The `mjml` library uses `readFileSync` internally to load its component
 * definitions, which fails in Vercel serverless with EBADF. This script
 * compiles MJML to HTML at build time, producing a .ts module that can be
 * imported without any filesystem access at runtime.
 *
 * Usage:
 *   npx tsx scripts/compile-email-template.ts
 */

import mjml2html from "mjml";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const TEMPLATE_DIR = join(__dirname, "../src/lib/email/templates");
const INPUT = join(TEMPLATE_DIR, "weekly-recap.mjml");
const OUTPUT = join(TEMPLATE_DIR, "weekly-recap-compiled.ts");

let template = readFileSync(INPUT, "utf-8");

// Wrap {{#if}}...{{/if}} in <mj-raw> so MJML preserves them as HTML comments
template = template.replace(/^(\s*)\{\{#if (\w+)\}\}\s*$/gm, "$1<mj-raw><!--IF_$2--></mj-raw>");
template = template.replace(/^(\s*)\{\{\/if\}\}\s*$/gm, "$1<mj-raw><!--/IF--></mj-raw>");

// Wrap raw HTML placeholders ({{votesHtml}} etc.) inside <mj-column> with <mj-raw>
template = template.replace(
  /<mj-column>\s*\{\{\s*(\w+Html)\s*\}\}\s*<\/mj-column>/g,
  "<mj-column><mj-raw>{{$1}}</mj-raw></mj-column>"
);

const { html, errors } = mjml2html(template, {
  validationLevel: "soft",
  minify: false,
});

if (errors.length > 0) {
  console.warn(
    "MJML warnings:",
    errors.map((e) => e.formattedMessage)
  );
}

// Convert HTML comment conditionals back to handlebar-style
let processed = html.replace(/<!--IF_(\w+)-->/g, "{{#if $1}}");
processed = processed.replace(/<!--\/IF-->/g, "{{/if}}");

// Escape backticks for template literal
const escaped = processed.replace(/`/g, "\\`").replace(/\$/g, "\\$");

const output =
  "// Auto-generated from weekly-recap.mjml — do not edit manually\n" +
  "// Regenerate with: npx tsx scripts/compile-email-template.ts\n\n" +
  "export const WEEKLY_RECAP_HTML = `" +
  escaped +
  "`;\n";

writeFileSync(OUTPUT, output);
console.log(`Compiled ${INPUT} → ${OUTPUT} (${output.length} chars)`);
