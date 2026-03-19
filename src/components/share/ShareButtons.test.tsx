import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { getShareText, getShareUrl } from "@/lib/share";
import { ShareButtons } from "./ShareButtons";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ShareButtons", () => {
  const url = "https://poligraph.fr/politiques/jean-dupont";
  const title = "Jean Dupont";
  const description = "Député du Rhône";
  const shareText = getShareText(title, description);
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render the 4 social share links with secure target attributes", () => {
    render(<ShareButtons url={url} title={title} description={description} />);

    const links = [
      {
        name: /partager sur x/i,
        expectedHref: getShareUrl("x", url, shareText),
      },
      {
        name: /partager sur bluesky/i,
        expectedHref: getShareUrl("bluesky", url, shareText),
      },
      {
        name: /partager sur facebook/i,
        expectedHref: getShareUrl("facebook", url, shareText),
      },
      {
        name: /partager sur whatsapp/i,
        expectedHref: getShareUrl("whatsapp", url, shareText),
      },
    ];

    for (const linkConfig of links) {
      const link = screen.getByRole("link", { name: linkConfig.name });
      expect(link).toHaveAttribute("href", linkConfig.expectedHref);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.querySelector("svg")).not.toBeNull();
    }
  });

  it("should copy the page URL and show a success feedback", async () => {
    writeText.mockResolvedValueOnce(undefined);

    render(<ShareButtons url={url} title={title} description={description} />);

    fireEvent.click(screen.getByRole("button", { name: /copier le lien/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(url);
      expect(toast.success).toHaveBeenCalledWith("Lien copié !");
      expect(screen.getByRole("button", { name: /lien copié/i })).toBeInTheDocument();
    });
  });

  it("should handle clipboard failures gracefully", async () => {
    writeText.mockRejectedValueOnce(new Error("Clipboard denied"));

    render(<ShareButtons url={url} title={title} description={description} />);

    fireEvent.click(screen.getByRole("button", { name: /copier le lien/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Impossible de copier le lien.");
    });
  });
});
