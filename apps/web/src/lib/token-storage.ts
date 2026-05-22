// localStorage-backed token storage.
//
// Tradeoff: localStorage is readable by any JS on the same origin, which means
// an XSS bug would expose tokens. For a learning project this is acceptable; a
// production system should use HttpOnly cookies plus CSRF protection instead.

const ACCESS_KEY = 'orderhub_access';
const REFRESH_KEY = 'orderhub_refresh';

function inBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const tokenStorage = {
  getAccess(): string | null {
    return inBrowser() ? window.localStorage.getItem(ACCESS_KEY) : null;
  },
  getRefresh(): string | null {
    return inBrowser() ? window.localStorage.getItem(REFRESH_KEY) : null;
  },
  set(access: string, refresh: string): void {
    if (!inBrowser()) return;
    window.localStorage.setItem(ACCESS_KEY, access);
    window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    if (!inBrowser()) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};
