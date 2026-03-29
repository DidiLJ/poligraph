import { cn } from "@/lib/utils";

interface MarkdownTextProps {
  children: string;
  className?: string;
  /** When true, markdown links render as plain text (use inside <a>/<Link> to avoid nested <a> hydration errors) */
  disableLinks?: boolean;
}

/**
 * Simple markdown renderer for basic formatting
 * Supports: **bold**, *italic*, [links](url), bullet points (• or -),
 * nested lists, --- horizontal rules, **heading** lines
 */
export function MarkdownText({ children, className, disableLinks }: MarkdownTextProps) {
  // Parse markdown to HTML
  const html = parseMarkdown(children, disableLinks);

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Check if a trimmed line is a bullet item (top-level or nested). */
function isBulletLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("•") || t.startsWith("- ") || t.startsWith("* ") || t === "-" || t === "*";
}

/** Remove bullet prefix from a line. */
function stripBullet(line: string): string {
  return line.trim().replace(/^[•\-*]\s*/, "");
}

/** Detect indentation level (number of leading spaces / 2). */
function indentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? Math.floor(match[1]!.length / 2) : 0;
}

/**
 * Convert an array of bullet lines into a nested <ul> HTML string.
 */
function buildList(lines: string[], disableLinks?: boolean): string {
  let html = '<ul class="list-disc pl-4 space-y-1">';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const level = indentLevel(line);
    const content = applyInlineFormatting(stripBullet(line), disableLinks);

    if (level === 0) {
      // Collect sub-items (indented lines following this one)
      const subLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && indentLevel(lines[j]!) > 0) {
        subLines.push(lines[j]!);
        j++;
      }

      if (subLines.length > 0) {
        // Dedent sub-lines by removing 2 leading spaces
        const dedented = subLines.map((l) => l.replace(/^ {1,2}/, ""));
        html += `<li>${content}${buildList(dedented, disableLinks)}</li>`;
      } else {
        html += `<li>${content}</li>`;
      }
      i = j;
    } else {
      // Shouldn't happen at top level, but handle gracefully
      html += `<li>${content}</li>`;
      i++;
    }
  }

  html += "</ul>";
  return html;
}

/**
 * Apply inline formatting (bold, italic, links) to a text string.
 * Must be called AFTER HTML escaping.
 */
function applyInlineFormatting(text: string, disableLinks?: boolean): string {
  let html = text;

  // Bold: **text** or __text__
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, url: string) => {
    if (disableLinks) return linkText as string;
    const isInternal = url.startsWith("/");
    if (!isInternal) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return linkText;
      } catch {
        return linkText;
      }
    }
    if (isInternal) {
      return `<a href="${url}" class="text-primary underline decoration-primary/40 hover:decoration-primary">${linkText}</a>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline decoration-primary/40 hover:decoration-primary">${linkText}</a>`;
  });

  return html;
}

/**
 * Parse basic markdown to HTML
 */
function parseMarkdown(text: string, disableLinks?: boolean): string {
  // Escape HTML entities first (security)
  let escaped = text;
  escaped = escaped.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Split into paragraph blocks (double newline)
  const paragraphs = escaped.split(/\n\n+/);

  return paragraphs
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";

      // Horizontal rule: --- or *** or ___
      if (/^[-*_]{3,}$/.test(trimmed)) {
        return '<hr class="my-4 border-border" />';
      }

      const lines = trimmed.split("\n");

      // Check if block is a bullet list
      const nonEmptyLines = lines.filter((l) => l.trim());
      const isList = nonEmptyLines.length > 0 && nonEmptyLines.every((l) => isBulletLine(l));

      if (isList) {
        return buildList(nonEmptyLines, disableLinks);
      }

      // Check for standalone bold heading: a single line that is entirely bold
      if (lines.length === 1 && /^\*\*[^*]+\*\*\s*$/.test(trimmed)) {
        return `<h4 class="font-semibold mt-4 mb-1">${applyInlineFormatting(trimmed, disableLinks)}</h4>`;
      }

      // Regular paragraph - preserve single line breaks
      const formatted = lines
        .map((l) => applyInlineFormatting(l.trim(), disableLinks))
        .join("<br />");
      return `<p>${formatted}</p>`;
    })
    .filter(Boolean)
    .join("");
}
