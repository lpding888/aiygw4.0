import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User | null, accessToken: string | null, refreshToken?: string | null) => void;
  setUser: (user: User | null) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
  clearAuth: () => void;
}

const syncLocalStorage = (user: User | null, accessToken: string | null, refreshToken: string | null) => {
  if (typeof window === 'undefined') return;

  if (accessToken) {
    localStorage.setItem('token', accessToken);
  } else {
    localStorage.removeItem('token');
  }

  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken);
  } else {
    localStorage.removeItem('refresh_token');
  }

  const persistPayload = JSON.stringify({
    state: {
      user,
      accessToken,
      refreshToken
    },
    version: 0
  });

  // Sync to Cookie for Middleware
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
    Cookies.set('auth-storage', persistPayload, { expires: 7, path: '/' });
  } else {
    localStorage.removeItem('user');
    Cookies.remove('auth-storage', { path: '/' });
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken = null) => {
        set({ user, accessToken, refreshToken });
        syncLocalStorage(user, accessToken, refreshToken);
      },
      setUser: (user) => {
        set({ user });
        syncLocalStorage(user, get().accessToken, get().refreshToken);
      },
      updateUser: (userData) => {
        set((state) => {
          if (!state.user) return state;
          const nextUser = { ...state.user, ...userData };
          syncLocalStorage(nextUser, state.accessToken, state.refreshToken);
          return { user: nextUser };
        });
      },
      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null });
        syncLocalStorage(null, null, null);
      },
      clearAuth: () => {
        set({ user: null, accessToken: null, refreshToken: null });
        syncLocalStorage(null, null, null);
      }
    }),
    {
      name: 'auth-storage'
    }
  )
);
