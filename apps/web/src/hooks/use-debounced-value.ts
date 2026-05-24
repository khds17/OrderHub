'use client';

import { useEffect, useState } from 'react';

/**
 * Return a value that lags behind `value` by `delayMs`, resetting the timer
 * on every change. Used to keep network requests from firing on every
 * keystroke in search inputs without giving up the snappy typing experience.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
