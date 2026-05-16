import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Poligraph",
    short_name: "Poligraph",
    description:
      "Observatoire citoyen de la vie politique française : mandats, votes, patrimoine, affaires judiciaires, fact-checking.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#002654",
    categories: ["news", "politics", "government"],
    // Next.js's MetadataRoute.Manifest types `purpose` as a single union value
    // ('any' | 'maskable' | 'monochrome'), so the W3C-allowed combined form
    // (`purpose: "any maskable"`) does not typecheck. We duplicate each size
    // with separate entries instead. Keep it this way.
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
