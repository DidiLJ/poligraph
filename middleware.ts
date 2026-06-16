import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";
import {
  resolveRateLimitMode,
  degradedActionForTier,
  isProductionRuntime,
  shouldEmitDegradedAlert,
  type RateLimitMode,
} from "@/lib/ratelimit/degraded-mode";
import { buildVotesListingRedirect } from "@/lib/parlement-votes-redirect";

// ─── Rate limit tiers ────────────────────────────────────────────

type RateLimitTier = "general" | "search" | "export" | "admin" | "subscribe";

const TIER_CONFIG: Record<RateLimitTier, { tokens: number; window: string }> = {
  general: { tokens: 60, window: "1m" },
  search: { tokens: 30, window: "1m" },
  export: { tokens: 5, window: "1m" },
  admin: { tokens: 30, window: "1m" },
  subscribe: { tokens: 8, window: "1m" },
};

// ─── Lazy-init rate limiters ─────────────────────────────────────

let redis: Redis | null = null;
const limiters = new Map<RateLimitTier, Ratelimit>();

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

function getLimiter(tier: RateLimitTier): Ratelimit | null {
  if (limiters.has(tier)) return limiters.get(tier)!;

  const client = getRedis();
  if (!client) return null;

  const config = TIER_CONFIG[tier];
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(config.tokens, config.window as `${number}${"s" | "m" | "h"}`),
    prefix: `rl:${tier}`,
  });

  limiters.set(tier, limiter);
  return limiter;
}

// ─── Degraded-mode alerting (Lot 3A) ─────────────────────────────

const DEGRADED_ALERT_THROTTLE_MS = 5 * 60 * 1000; // 5 min
let lastDegradedAlertAt: number | null = null;

/**
 * Surface that rate limiting is degraded (Upstash unconfigured or unreachable).
 * Throttled so it fires at most once per window per edge instance, never per
 * request. In production the signal is a console error (visible in Vercel logs)
 * plus a Sentry warning; outside production a single light log. The Sentry event
 * is flushed via `event.waitUntil` because an edge isolate can freeze right after
 * the response, which would otherwise drop the in-flight event. No public header
 * is emitted, to avoid telling clients that throttling is off.
 */
function reportDegradedMode(
  mode: RateLimitMode,
  tier: RateLimitTier,
  pathname: string,
  event: NextFetchEvent
): void {
  if (mode === "enforced") return;
  const now = Date.now();
  if (!shouldEmitDegradedAlert(lastDegradedAlertAt, now, DEGRADED_ALERT_THROTTLE_MS)) {
    return;
  }
  lastDegradedAlertAt = now;

  const detail = `Upstash indisponible, limitation de débit désactivée (tier=${tier}, route=${pathname})`;
  if (mode === "degraded-prod") {
    // eslint-disable-next-line no-console -- deliberate ops signal (Vercel logs)
    console.error(`[ratelimit] PRODUCTION ${detail}`);
    Sentry.captureMessage(`Rate limiting dégradé : ${detail}`, "warning");
    event.waitUntil(Sentry.flush(2000));
  } else {
    // eslint-disable-next-line no-console -- deliberate ops signal (dev)
    console.warn(`[ratelimit] ${detail} (hors production, fallback autorisé)`);
  }
}

/**
 * Build the response for the degraded path (Upstash unavailable): throttled
 * alert, then fail the export tier closed (503) in production while letting
 * everything else through. Shared by the unconfigured and the runtime-outage
 * branches so both follow the same explicit policy.
 */
function degradedResponse(
  tier: RateLimitTier,
  pathname: string,
  request: NextRequest,
  event: NextFetchEvent
): NextResponse {
  const mode = resolveRateLimitMode(false, isProductionRuntime(process.env));
  reportDegradedMode(mode, tier, pathname, event);

  if (degradedActionForTier(mode, tier) === "block") {
    const blocked = NextResponse.json(
      { error: "Limitation de débit indisponible. Réessayez plus tard." },
      {
        status: 503,
        headers: {
          "Retry-After": "60",
          ...(isV1Route(pathname) ? CORS_HEADERS : {}),
        },
      }
    );
    applySubscribeCors(request, blocked);
    return blocked;
  }

  const response = NextResponse.next();
  if (isV1Route(pathname)) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  }
  applySubscribeCors(request, response);
  return response;
}

// ─── Route → tier mapping ────────────────────────────────────────

function getTier(pathname: string): RateLimitTier | null {
  // Excluded routes — handled by their own rate limiting or internal
  if (pathname.startsWith("/api/chat")) return null;
  if (pathname.startsWith("/api/cron")) return null;
  // Mailjet webhook is signed with HMAC; rate limit per-IP would punish bursty
  // legitimate batches from a small set of Mailjet IPs.
  if (pathname.startsWith("/api/newsletter/webhook")) return null;

  // Admin routes — separate tier (auth endpoint has its own stricter limiter too)
  if (pathname.startsWith("/api/admin")) return "admin";

  if (
    pathname.startsWith("/api/newsletter/subscribe") ||
    pathname.startsWith("/api/newsletter/forget")
  ) {
    return "subscribe";
  }
  if (pathname.startsWith("/api/export")) return "export";
  if (pathname.startsWith("/api/search")) return "search";
  if (pathname.startsWith("/api/")) return "general";

  return null;
}

// ─── Client IP extraction ────────────────────────────────────────

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]!.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

// ─── CORS for public v1 API ──────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function isV1Route(pathname: string): boolean {
  return pathname.startsWith("/api/v1/");
}

// ─── CORS for newsletter subscribe (boussole) ────────────────────

const SUBSCRIBE_CORS_ORIGINS = ["https://boussole.poligraph.fr", "http://localhost:8081"];

function applySubscribeCors(request: NextRequest, response: NextResponse): void {
  if (request.nextUrl.pathname !== "/api/newsletter/subscribe") return;
  const origin = request.headers.get("origin");
  if (!origin || !SUBSCRIBE_CORS_ORIGINS.includes(origin)) return;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Vary", "Origin");
}

// ─── Middleware ───────────────────────────────────────────────────

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  // Canonicalize the legacy /parlement?<filters> listing to /parlement/votes.
  // Real HTTP 308 issued before any rendering; the bare /parlement hub (no
  // listing param) falls through to the rate-limit logic below as a passthrough.
  if (pathname === "/parlement") {
    const target = buildVotesListingRedirect(request.nextUrl.searchParams);
    if (target) {
      return NextResponse.redirect(new URL(target, request.url), 308);
    }
  }

  // CORS preflight for v1 API
  if (isV1Route(pathname) && request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  const tier = getTier(pathname);
  if (!tier) {
    const passthrough = NextResponse.next();
    applySubscribeCors(request, passthrough);
    return passthrough;
  }

  const limiter = getLimiter(tier);
  if (!limiter) {
    // Upstash not configured: explicit degraded mode instead of a silent
    // fallback (Lot 3A).
    return degradedResponse(tier, pathname, request, event);
  }

  const ip = getClientIp(request);
  let success: boolean;
  let limit: number;
  let remaining: number;
  let reset: number;
  try {
    ({ success, limit, remaining, reset } = await limiter.limit(ip));
  } catch {
    // Upstash configured but unreachable at runtime: degrade gracefully through
    // the same explicit policy instead of throwing a 500 on every API tier.
    return degradedResponse(tier, pathname, request, event);
  }

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    const headers: Record<string, string> = {
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(reset),
      ...(isV1Route(pathname) ? CORS_HEADERS : {}),
    };
    const limited = NextResponse.json(
      { error: "Trop de requêtes. Réessayez plus tard." },
      { status: 429, headers }
    );
    applySubscribeCors(request, limited);
    return limited;
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(reset));
  if (isV1Route(pathname)) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  }
  applySubscribeCors(request, response);
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/parlement"],
};
