/**
 * Validate a `?next=` redirect target. Returns the path if it's a safe
 * same-origin path, otherwise the provided fallback.
 *
 * Blocks:
 *   - Absolute URLs ("https://evil.com/x") that would bounce off-site.
 *   - Protocol-relative URLs ("//evil.com/x") — these are parsed as absolute
 *     by browsers and are the classic open-redirect footgun.
 *   - Non-string and missing values.
 *
 * Accepts only paths that start with a single "/" and not "//".
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (typeof next !== 'string' || next.length === 0) return fallback;
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//')) return fallback;
  return next;
}
