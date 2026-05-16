// Service worker Poligraph - offline-first sur fiches politicien et affaire.
// Garder en sync avec src/lib/pwa/sw-config.ts pour la version et les patterns.

const SW_VERSION = "v1";
const DOCUMENT_CACHE = `poligraph-docs-${SW_VERSION}`;
const STATIC_CACHE = `poligraph-static-${SW_VERSION}`;
const MAX_DOCUMENTS = 50;

const CACHEABLE_DOCUMENT_PATTERNS = [/^\/politiques\/[^/]+$/, /^\/affaires\/[^/]+$/];

const STATIC_ASSET_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icon-\d+\.png$/,
  /^\/logo\.(svg|png)$/,
  /^\/apple-icon/,
  /^\/manifest\.webmanifest$/,
  /^\/favicon\./,
];

function isCacheableDocument(pathname) {
  return CACHEABLE_DOCUMENT_PATTERNS.some((re) => re.test(pathname));
}
function isApiRoute(pathname) {
  return pathname.startsWith("/api/");
}
function isStaticAsset(pathname) {
  return STATIC_ASSET_PATTERNS.some((re) => re.test(pathname));
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const expected = new Set([DOCUMENT_CACHE, STATIC_CACHE]);
      await Promise.all(
        keys
          .filter((key) => key.startsWith("poligraph-") && !expected.has(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxItems) return;
  const toDelete = keys.slice(0, keys.length - maxItems);
  await Promise.all(toDelete.map((req) => cache.delete(req)));
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DOCUMENT_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        await cache.put(request, response.clone());
        await trimCache(DOCUMENT_CACHE, MAX_DOCUMENTS);
      }
      return response;
    })
    .catch(() => null);
  return cached || network || Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isApiRoute(url.pathname)) return;

  if (request.mode === "navigate" && isCacheableDocument(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
});
