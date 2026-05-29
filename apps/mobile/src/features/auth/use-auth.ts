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
  refreshUser: () => Promise<User | null>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  async init() {
    await tokenStorage.hydrate();
    if (!tokenStorage.getAccess()) {
      set({ status: 'unauthenticated', user: null });
      return;
    }
    set({ status: 'loading' });
    try {
      const { user } = await api.users.me();
      set({ user, status: 'authenticated' });
    } catch {
      await tokenStorage.clear();
      set({ status: 'unauthenticated', user: null });
    }
  },
  async login(email, password) {
    set({ status: 'loading' });
    const { user, tokens } = await api.auth.login({ email, password });
    await tokenStorage.set(tokens.accessToken, tokens.refreshToken);
    set({ user, status: 'authenticated' });
    return user;
  },
  async register(email, password, name) {
    set({ status: 'loading' });
    const { user, tokens } = await api.auth.register({ email, password, name });
    await tokenStorage.set(tokens.accessToken, tokens.refreshToken);
    set({ user, status: 'authenticated' });
    return user;
  },
  async logout() {
    const refresh = tokenStorage.getRefresh();
    if (refresh) {
      try {
        await api.auth.logout({ refreshToken: refresh });
      } catch {
        // best-effort revoke
      }
    }
    await tokenStorage.clear();
    set({ user: null, status: 'unauthenticated' });
  },
  async refreshUser() {
    try {
      const { user } = await api.users.me();
      set({ user, status: 'authenticated' });
      return user;
    } catch {
      set({ user: null, status: 'unauthenticated' });
      return null;
    }
  },
}));

setOnAuthFailure(() => {
  useAuth.setState({ user: null, status: 'unauthenticated' });
});
