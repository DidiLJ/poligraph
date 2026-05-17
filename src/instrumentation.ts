import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
const SENTRY_ENABLED = Boolean(SENTRY_DSN) && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false";

export async function register() {
  if (!SENTRY_ENABLED) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
      sendDefaultPii: false,
      ignoreErrors: [
        // Benign Next.js control-flow errors (redirect, notFound) surface as thrown exceptions
        "NEXT_REDIRECT",
        "NEXT_NOT_FOUND",
        "DYNAMIC_SERVER_USAGE",
      ],
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
      sendDefaultPii: false,
      ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND"],
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
