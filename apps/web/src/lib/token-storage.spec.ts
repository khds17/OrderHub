import { describe, it, expect, beforeEach } from '@jest/globals';
import { tokenStorage } from './token-storage';

// Minimal in-memory localStorage shim so the module's `inBrowser()` check
// passes under a Node test runner.
function installFakeLocalStorage(): void {
  const store = new Map<string, string>();
  const fake: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
  (globalThis as unknown as { window?: { localStorage: Storage } }).window = {
    localStorage: fake,
  };
}

describe('tokenStorage', () => {
  beforeEach(() => {
    installFakeLocalStorage();
    tokenStorage.clear();
  });

  it('returns null before any tokens are set', () => {
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });

  it('round-trips access and refresh tokens', () => {
    tokenStorage.set('access-1', 'refresh-1');
    expect(tokenStorage.getAccess()).toBe('access-1');
    expect(tokenStorage.getRefresh()).toBe('refresh-1');
  });

  it('clear() removes both tokens', () => {
    tokenStorage.set('a', 'r');
    tokenStorage.clear();
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });
});
