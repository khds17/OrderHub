import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'orderhub_access';
const REFRESH_KEY = 'orderhub_refresh';

let accessCache: string | null = null;
let refreshCache: string | null = null;
let hydrated = false;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  accessCache = await SecureStore.getItemAsync(ACCESS_KEY);
  refreshCache = await SecureStore.getItemAsync(REFRESH_KEY);
  hydrated = true;
}

export const tokenStorage = {
  hydrate,
  getAccess(): string | null {
    return accessCache;
  },
  getRefresh(): string | null {
    return refreshCache;
  },
  async set(access: string, refresh: string): Promise<void> {
    accessCache = access;
    refreshCache = refresh;
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  async clear(): Promise<void> {
    accessCache = null;
    refreshCache = null;
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
