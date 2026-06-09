import { create } from 'zustand';
import { User } from '@docmind/shared';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
  setInitialized: (initialized: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isInitialized: false,
  setAuth: (user, accessToken) => {
    localStorage.setItem('accessToken', accessToken);
    set({
      user,
      accessToken,
      isAuthenticated: true,
    });
  },
  clearAuth: () => {
    localStorage.removeItem('accessToken');
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  },
  setInitialized: (isInitialized) => set({ isInitialized }),
}));
