// Resolve the Upstash Redis REST credentials used by the API rate limiter.
//
// Priority: the Vercel/Upstash INTEGRATION variables (POLIGRAPH_API_KV_REST_API_*)
// first, because they are managed by the integration and follow token rotations.
// Manual UPSTASH_REDIS_REST_* aliases are a fallback (local dev, or a standard
// environment). The READ_ONLY token is intentionally never used: the sliding
// window WRITES to Redis.
//
// Returns null when neither pair is fully configured, so the caller can run with
// rate limiting OFF rather than failing closed (a missing config must never break
// /api/export).
export function getUpstashCredentials(): { url: string; token: string } | null {
  const url = process.env.POLIGRAPH_API_KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.POLIGRAPH_API_KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;
  return { url, token };
}
