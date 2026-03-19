"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";
import { Check, Facebook, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getShareText, getShareUrl, type SharePlatform } from "@/lib/share";

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

function XIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.244 2H21l-6.55 7.49L22.16 22h-6.037l-4.728-6.18L5.99 22H3.23l7-8.004L2 2h6.19l4.274 5.594L18.244 2Zm-1.058 18h1.527L7.36 3.894H5.721L17.186 20Z" />
    </svg>
  );
}

function BlueskyIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 600 530" fill="currentColor" aria-hidden="true" {...props}>
      <path d="m133.2 36.9c72.4 54.4 150.3 164.9 166.8 198.7 16.6-33.8 94.5-144.3 166.8-198.7 52.2-39.3 136.8-69.7 136.8 26.8 0 19.3-11.1 162.2-17.6 185.4-22.4 80.6-104 101.1-176.6 88.8 126.9 21.6 159.2 93 89.5 164.4-132.4 135.7-190.3-34-205.1-77.5-2.7-8-4-11.8-4-8.7 0-3.1-1.3.7-4 8.7-14.8 43.5-72.7 213.2-205.1 77.5-69.7-71.4-37.4-142.8 89.5-164.4-72.6 12.3-154.2-8.2-176.6-88.8C7.5 225.9-3.6 83 .1 63.7c0-96.5 84.6-66 136.8-26.8Z" />
    </svg>
  );
}

function WhatsAppIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19.05 4.94A9.86 9.86 0 0 0 12.02 2C6.56 2 2.1 6.45 2.1 11.93c0 1.76.46 3.48 1.34 4.99L2 22l5.23-1.37a9.9 9.9 0 0 0 4.78 1.22h.01c5.46 0 9.92-4.45 9.92-9.93a9.84 9.84 0 0 0-2.89-6.98Zm-7.03 15.23h-.01a8.26 8.26 0 0 1-4.2-1.15l-.3-.18-3.1.81.83-3.02-.2-.31a8.23 8.23 0 0 1-1.26-4.39c0-4.57 3.72-8.29 8.31-8.29 2.22 0 4.31.86 5.87 2.42a8.2 8.2 0 0 1 2.43 5.87c0 4.57-3.73 8.29-8.37 8.29Zm4.55-6.18c-.25-.12-1.48-.73-1.71-.81-.23-.08-.39-.12-.56.12-.16.23-.64.8-.78.97-.14.16-.28.19-.53.06-.25-.12-1.04-.38-1.97-1.21-.73-.65-1.22-1.45-1.36-1.7-.14-.24-.01-.37.11-.49.11-.11.25-.28.37-.42.13-.14.16-.23.25-.39.08-.16.04-.29-.02-.41-.06-.12-.56-1.35-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.16 0-.41.06-.62.29-.21.23-.81.79-.81 1.92 0 1.13.83 2.23.94 2.39.12.16 1.64 2.5 3.98 3.5.56.24 1 .38 1.34.49.56.18 1.07.16 1.47.1.45-.07 1.48-.6 1.69-1.18.21-.58.21-1.08.15-1.18-.06-.1-.22-.16-.47-.29Z" />
    </svg>
  );
}

const SOCIAL_BUTTONS: Array<{
  platform: SharePlatform;
  label: string;
  icon: ComponentType<ComponentProps<"svg">>;
}> = [
  { platform: "x", label: "X", icon: XIcon },
  { platform: "bluesky", label: "Bluesky", icon: BlueskyIcon },
  { platform: "facebook", label: "Facebook", icon: Facebook },
  { platform: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
];

export function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const shareText = useMemo(() => getShareText(title, description), [description, title]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié !");

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2000);
    } catch {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setCopied(false);
      toast.error("Impossible de copier le lien.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Options de partage" role="group">
      {SOCIAL_BUTTONS.map(({ platform, label, icon: Icon }) => (
        <Button key={platform} asChild variant="outline" size="sm">
          <a
            href={getShareUrl(platform, url, shareText)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Partager sur ${label}`}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </a>
        </Button>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        aria-label={copied ? "Lien copié" : "Copier le lien"}
      >
        {copied ? <Check className="size-4 text-green-600" /> : <Link2 className="size-4" />}
        <span>{copied ? "Lien copié" : "Copier le lien"}</span>
      </Button>
    </div>
  );
}
