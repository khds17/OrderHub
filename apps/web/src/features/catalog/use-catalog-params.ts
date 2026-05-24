'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * URL-synced controller for the catalog list pages.
 *
 * - `qInput` is the raw text bound to the search field (updates on every
 *   keystroke).
 * - `q` is debounced (300 ms) so we don't fire a request per character.
 * - `offset` is the current page offset; resets to 0 whenever `q` changes,
 *   otherwise paging "Widget" page 3 would land you on results-of-{} page 3.
 * - URL params (`?q=&offset=`) reflect the debounced values, so reloads and
 *   browser back/forward restore the same view.
 *
 * Returning a single hook keeps `/products` and `/admin/products` from
 * reinventing this dance with subtly different bugs.
 */
export function useCatalogParams(): {
  qInput: string;
  setQInput: (v: string) => void;
  q: string;
  offset: number;
  goToOffset: (next: number) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Seed from the URL once, then keep local state authoritative.
  const initialQ = searchParams.get('q') ?? '';
  const initialOffsetRaw = Number(searchParams.get('offset') ?? '0');
  const initialOffset =
    Number.isFinite(initialOffsetRaw) && initialOffsetRaw >= 0
      ? Math.floor(initialOffsetRaw)
      : 0;

  const [qInput, setQInput] = useState(initialQ);
  const [offset, setOffset] = useState(initialOffset);

  const q = useDebouncedValue(qInput.trim(), SEARCH_DEBOUNCE_MS);

  // Reset to the first page whenever the (debounced) search changes — paging
  // 3 of "Widget" → typing into the box must take you back to page 1.
  useEffect(() => {
    setOffset(0);
    // q only — intentionally not depending on `offset` to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Reflect debounced q + current offset to the URL.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (offset > 0) params.set('offset', String(offset));
    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    router.replace(next, { scroll: false });
  }, [q, offset, pathname, router]);

  return useMemo(
    () => ({
      qInput,
      setQInput,
      q,
      offset,
      goToOffset: setOffset,
    }),
    [qInput, q, offset],
  );
}
