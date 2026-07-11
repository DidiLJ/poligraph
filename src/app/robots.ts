import { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";
const isProduction =
  process.env.VERCEL_ENV === "production" ||
  (!process.env.VERCEL_ENV && SITE_URL.includes("poligraph.fr") && !SITE_URL.includes("staging"));

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: isProduction ? "/" : undefined,
        disallow: isProduction
          ? [
              "/admin/",
              "/api/admin/",
              // Historical municipal elections never change: block crawl so bots
              // stop triggering ISR regenerations on ~70K dead commune pages.
              "/elections/municipales-2014/",
              "/elections/municipales-2020/",
              // Paginated listings are duplicate content (canonical points to
              // page 1): block crawl to avoid regenerating every ?page= variant.
              "/*?*page=",
            ]
          : ["/"],
      },
    ],
    sitemap: isProduction
      ? [
          `${SITE_URL}/sitemap/0.xml`,
          `${SITE_URL}/sitemap/1.xml`,
          `${SITE_URL}/sitemap/2.xml`,
          `${SITE_URL}/sitemap/3.xml`,
          `${SITE_URL}/sitemap/4.xml`,
        ]
      : undefined,
  };
}
