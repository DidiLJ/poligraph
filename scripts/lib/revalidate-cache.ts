export type CacheRevalidationEnv = Readonly<Record<string, string | undefined>>;

interface RevalidateRemoteCacheOptions {
  env?: CacheRevalidationEnv;
  fetchImpl?: typeof fetch;
}

function ensureProtocol(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function resolveRevalidationBaseUrl(env: CacheRevalidationEnv = process.env): string {
  const configuredBaseUrl = env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configuredBaseUrl) return ensureProtocol(configuredBaseUrl).replace(/\/$/, "");

  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) return ensureProtocol(vercelUrl).replace(/\/$/, "");

  return "http://localhost:3000";
}

export async function revalidateRemoteCache(
  tags: string[],
  options: RevalidateRemoteCacheOptions = {}
): Promise<void> {
  const env = options.env ?? process.env;
  const secret = env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error("CRON_SECRET is required for remote cache revalidation");
  }
  if (tags.length === 0) {
    throw new Error("At least one cache tag is required for remote revalidation");
  }

  const endpoint = `${resolveRevalidationBaseUrl(env)}/api/cron/revalidate`;
  const response = await (options.fetchImpl ?? fetch)(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tags }),
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(
      `Remote cache revalidation failed with HTTP ${response.status}${body ? `: ${body}` : ""}`
    );
  }
}
