import { stripMarkdown } from "./utils";

export type SharePlatform = "x" | "bluesky" | "facebook" | "whatsapp";

const SHARE_TEXT_LIMIT = 250;
const BLUESKY_MAX_CHARS = 300;
const SHARE_SUFFIX = " sur Poligraph";
const TRUNCATED_SHARE_SUFFIX = `…${SHARE_SUFFIX}`;

function normalizeShareSegment(value: string) {
  return stripMarkdown(value).replace(/\s+/g, " ").trim();
}

function truncateShareBase(baseText: string) {
  const maxBaseLength = SHARE_TEXT_LIMIT - TRUNCATED_SHARE_SUFFIX.length;
  const shortened = baseText.slice(0, maxBaseLength).trim();
  const lastWordBoundary = shortened.lastIndexOf(" ");

  if (lastWordBoundary > Math.floor(maxBaseLength * 0.6)) {
    return shortened.slice(0, lastWordBoundary).trim();
  }

  return shortened;
}

export function getShareText(title: string, description?: string) {
  const normalizedTitle = normalizeShareSegment(title);
  const normalizedDescription = description ? normalizeShareSegment(description) : "";
  const baseText = normalizedDescription
    ? `${normalizedTitle} — ${normalizedDescription}`
    : normalizedTitle;
  const fullText = `${baseText}${SHARE_SUFFIX}`;

  if (fullText.length <= SHARE_TEXT_LIMIT) {
    return fullText;
  }

  return `${truncateShareBase(baseText)}${TRUNCATED_SHARE_SUFFIX}`;
}

export function getShareUrl(platform: SharePlatform, url: string, text: string) {
  switch (platform) {
    case "x":
      return `https://twitter.com/intent/tweet?${new URLSearchParams({ text, url }).toString()}`;
    case "bluesky": {
      const blueskyBody = `${text} ${url}`;
      let truncatedBody: string;

      if (blueskyBody.length > BLUESKY_MAX_CHARS) {
        const remainingLength = BLUESKY_MAX_CHARS - url.length - 2; // account for "… "

        if (remainingLength <= 0) {
          // URL alone fills (or exceeds) the character budget; share just the URL
          truncatedBody = url;
        } else {
          truncatedBody = `${text.slice(0, remainingLength).trimEnd()}… ${url}`;
        }
      } else {
        truncatedBody = blueskyBody;
      }

      return `https://bsky.app/intent/compose?${new URLSearchParams({
        text: truncatedBody,
      }).toString()}`;
    }
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({
        u: url,
      }).toString()}`;
    case "whatsapp":
      return `https://wa.me/?${new URLSearchParams({ text: `${text} ${url}` }).toString()}`;
    default: {
      const _exhaustiveCheck: never = platform;
      throw new Error(`Unsupported share platform: ${String(_exhaustiveCheck)}`);
    }
  }
}
