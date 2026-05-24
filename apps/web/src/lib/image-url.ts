/**
 * The API returns image URLs as relative paths (e.g. `/uploads/products/...`)
 * because the static handler is mounted on the API server, which lives at a
 * different origin than the web app in development. Prefix them with the
 * configured API base so <img src> resolves correctly across origins.
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function absoluteImageUrl(url: string): string {
  // Already absolute (http(s) or protocol-relative) — pass through.
  if (/^(https?:)?\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}
