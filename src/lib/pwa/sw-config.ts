export const SW_CACHE_VERSION = "v1";

export const DOCUMENT_CACHE = `poligraph-docs-${SW_CACHE_VERSION}`;
export const STATIC_CACHE = `poligraph-static-${SW_CACHE_VERSION}`;
export const MAX_DOCUMENTS = 50;

const CACHEABLE_DOCUMENT_PATTERNS = [/^\/politiques\/[^/]+$/, /^\/affaires\/[^/]+$/];

const STATIC_ASSET_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icon-\d+\.png$/,
  /^\/logo\.(svg|png)$/,
  /^\/apple-icon/,
  /^\/manifest\.webmanifest$/,
  /^\/favicon\./,
];

export function isCacheableDocument(pathname: string): boolean {
  return CACHEABLE_DOCUMENT_PATTERNS.some((re) => re.test(pathname));
}

export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function isStaticAsset(pathname: string): boolean {
  return STATIC_ASSET_PATTERNS.some((re) => re.test(pathname));
}
