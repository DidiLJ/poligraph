import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENABLED = Boolean(SENTRY_DSN) && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false";

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    integrations: [Sentry.replayIntegration({ maskAllText: false, blockAllMedia: true })],
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Network request failed",
      "NetworkError",
      "AbortError",
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
