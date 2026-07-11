import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { SITE_URL, SITE_HOSTNAME } from "./src/config/site";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jsdom"],
  staticPageGenerationTimeout: 120,
  // Content syncs at most once a day and is invalidated on-demand via
  // revalidateTag (daily sync + admin edits), so the time-based ISR window is a
  // 24h backstop rather than the driver of freshness. The built-in "minutes"
  // profile (revalidate 60s) was regenerating the whole long-tail every minute
  // on crawler traffic, which dominated ISR write cost.
  cacheLife: {
    synced: { stale: 3600, revalidate: 86400, expire: 604800 },
  },
  outputFileTracingIncludes: {
    "/departements/[slug]/opengraph-image": ["./public/data/departements.geojson"],
    "/elections/municipales-2026/communes/[inseeCode]/opengraph-image": [
      "./public/data/departements.geojson",
    ],
  },
  experimental: {
    useCache: true,
    webpackMemoryOptimizations: true,
    webpackBuildWorker: true,
  },
  images: {
    remotePatterns: [
      // Assemblee nationale
      { protocol: "https", hostname: "www.assemblee-nationale.fr" },
      { protocol: "https", hostname: "www2.assemblee-nationale.fr" },
      { protocol: "https", hostname: "data.assemblee-nationale.fr" },
      // Senat
      { protocol: "https", hostname: "www.senat.fr" },
      { protocol: "https", hostname: "data.senat.fr" },
      // Wikimedia (Wikidata photos)
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      // HATVP
      { protocol: "https", hostname: "www.hatvp.fr" },
      // European Parliament
      { protocol: "https", hostname: "**.europarl.europa.eu" },
      // Gouvernement
      { protocol: "https", hostname: "www.gouvernement.fr" },
      // NosDéputés / NosSénateurs
      { protocol: "https", hostname: "www.nosdeputes.fr" },
      { protocol: "https", hostname: "www.nossenateurs.fr" },
      // data.gouv.fr (election photos)
      { protocol: "https", hostname: "www.data.gouv.fr" },
      { protocol: "https", hostname: "static.data.gouv.fr" },
      // Vercel Blob (cached politician photos)
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    const securityHeaders = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self)",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          // unsafe-inline required: Next.js inline scripts (chunks, RSC), JSON-LD, Umami
          // TODO: migrate to nonce-based CSP when Next.js supports it natively
          `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://cloud.umami.is https://vercel.live`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' https: data:",
          "font-src 'self'",
          "worker-src 'self'",
          "connect-src 'self' https://cloud.umami.is https://api-gateway.umami.dev https://vercel.live https://api.anthropic.com https://geo.api.gouv.fr",
          "frame-ancestors 'none'",
        ].join(" https://gateway.umami.is; "),
      },
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/api/docs",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Redirect www to non-www (canonical domain)
      {
        source: "/:path*",
        has: [{ type: "host", value: `www.${SITE_HOSTNAME}` }],
        destination: `${SITE_URL}/:path*`,
        permanent: true,
      },
      {
        source: "/stats",
        destination: "/statistiques",
        permanent: true,
      },
      {
        source: "/api-docs",
        destination: "/docs/api",
        permanent: true,
      },
      {
        source: "/politique/:slug",
        destination: "/politiques/:slug",
        permanent: true,
      },
      {
        source: "/parti/:slug",
        destination: "/partis/:slug",
        permanent: true,
      },
      {
        source: "/votes/:path*",
        destination: "/parlement/votes/:path*",
        statusCode: 308,
      },
      {
        source: "/assemblee/:path*",
        destination: "/parlement/dossiers/:path*",
        statusCode: 308,
      },
      {
        source: "/votes",
        destination: "/parlement/votes",
        statusCode: 308,
      },
      {
        source: "/assemblee",
        destination: "/parlement/dossiers",
        statusCode: 308,
      },
      {
        source: "/partis/ensemble-pour-la-republique",
        destination: "/partis/renaissance",
        permanent: true,
      },
      // Affair slugs that leaked the "À vérifier" moderation prefix (2026-04 -> 2026-05).
      // Cleaned in DB on 2026-05-17; these 308s preserve the SEO of the old URLs.
      {
        source: "/affaires/a-verifier-plainte-pour-manquements-lors-d-une-garde-a-vue",
        destination: "/affaires/plainte-pour-manquements-lors-d-une-garde-a-vue",
        statusCode: 308,
      },
      {
        source:
          "/affaires/a-verifier-tentatives-d-ingerence-presumees-de-lagardere-news-dans-une-commission-parlementaire",
        destination:
          "/affaires/tentatives-d-ingerence-presumees-de-lagardere-news-dans-une-commission-parlementaire",
        statusCode: 308,
      },
      {
        source:
          "/affaires/a-verifier-plainte-pour-prise-illegale-d-interets-dans-le-cadre-de-la-commission-sur-l-audiovisuel-public",
        destination:
          "/affaires/plainte-pour-prise-illegale-d-interets-dans-le-cadre-de-la-commission-sur-l-audiovisuel-public",
        statusCode: 308,
      },
    ];
  },
};

const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN);
// Attempt source map upload / release creation only when fully configured
// (token + org + project). A partial or invalid config must never pollute the
// build log nor risk failing the build; runtime DSN reporting is independent.
const sentryUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);
// Visible-but-short heads-up when Sentry is on (DSN set) but the upload creds
// are incomplete: not silent, not spammy, never blocking. (Only fires when a DSN
// is present, so local dev without a DSN stays quiet.)
if (sentryEnabled && !sentryUploadEnabled) {
  // eslint-disable-next-line no-console -- intentional build-time diagnostic
  console.warn(
    "[sentry] source map upload disabled: set SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT."
  );
}

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      // Upload source maps only when token + org + project are all set
      sourcemaps: { disable: !sentryUploadEnabled },
      widenClientFileUpload: true,
      // Route Sentry events through our domain to bypass ad blockers
      tunnelRoute: "/monitoring",
      disableLogger: true,
      // Instruments Vercel Cron jobs defined in vercel.json automatically
      automaticVercelMonitors: true,
      // A bad/partial upload config must not break or spam the build log
      errorHandler: (err) => {
        // eslint-disable-next-line no-console -- intentional build-time diagnostic
        console.warn("[sentry] source map upload failed (non-blocking):", err.message);
      },
    })
  : nextConfig;
