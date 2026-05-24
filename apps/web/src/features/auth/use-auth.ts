'use client';

import { create } from 'zustand';
import type { User } from '@orderhub/contracts';
import { api, setOnAuthFailure } from '@/lib/api-client';
import { tokenStorage } from '@/lib/token-storage';

type AuthState = {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Re-fetch /users/me and replace the cached user. Called after a profile
   *  save so the nav, profile form, and any other readers reflect the new
   *  values without a full page reload. */
  refreshUser: () => Promise<User | null>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  async init() {
    if (!tokenStorage.getAccess()) {
      set({ status: 'unauthenticated', user: null });
      return;
    }
    set({ status: 'loading' });
    try {
      const { user } = await api.users.me();
      set({ user, status: 'authenticated' });
    } catch {
      tokenStorage.clear();
      set({ status: 'unauthenticated', user: null });
    }
  },
  async login(email, password) {
    set({ status: 'loading' });
    const { user, tokens } = await api.auth.login({ email, password });
    tokenStorage.set(tokens.accessToken, tokens.refreshToken);
    set({ user, status: 'authenticated' });
    return user;
  },
  async register(email, password, name) {
    set({ status: 'loading' });
    const { user, tokens } = await api.auth.register({ email, password, name });
    tokenStorage.set(tokens.accessToken, tokens.refreshToken);
    set({ user, status: 'authenticated' });
    return user;
  },
  async logout() {
    const refresh = tokenStorage.getRefresh();
    if (refresh) {
      try {
        await api.auth.logout({ refreshToken: refresh });
      } catch {
        // Even if revocation fails server-side, we still clear local state.
      }
    }
    tokenStorage.clear();
    set({ user: null, status: 'unauthenticated' });
  },
  async refreshUser() {
    try {
      const { user } = await api.users.me();
      set({ user, status: 'authenticated' });
      return user;
    } catch {
      // Surface as "not signed in" rather than half-stale; the api-client's
      // 401 path also clears tokens, so this set keeps state internally
      // consistent.
      set({ user: null, status: 'unauthenticated' });
      return null;
    }
  },
}));

// Wire the api-client's "auth failure" hook to the auth store so a failed
// refresh transparently logs the user out (instead of leaving stale UI state).
if (typeof window !== 'undefined') {
  setOnAuthFailure(() => {
    useAuth.setState({ user: null, status: 'unauthenticated' });
  });
}
