/**
 * Client-safe share utilities for social platforms.
 * No server dependencies (unlike src/lib/social/post.ts).
 */

const BLUESKY_MAX_CHARS = 300;

type Platform = "x" | "bluesky" | "facebook" | "whatsapp";

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3).trimEnd() + "...";
}

export function buildShareUrl(platform: Platform, text: string, url: string): string {
  const encodedUrl = encodeURIComponent(url);

  switch (platform) {
    case "x": {
      const encodedText = encodeURIComponent(text);
      return `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    }
    case "bluesky": {
      // Bluesky compose includes URL in char count
      const urlLen = url.length + 2; // "\n\n" prefix
      const truncated = truncateText(text, BLUESKY_MAX_CHARS - urlLen);
      const fullText = encodeURIComponent(`${truncated}\n\n${url}`);
      return `https://bsky.app/intent/compose?text=${fullText}`;
    }
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "whatsapp": {
      const whatsappText = encodeURIComponent(`${text}\n${url}`);
      return `https://wa.me/?text=${whatsappText}`;
    }
  }
}

export interface ShareData {
  title: string;
  text: string;
  url: string;
}
