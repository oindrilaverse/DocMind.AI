import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { AuthResponse } from '@docmind/shared';

export function useAuth() {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const setInitialized = useAuthStore((state) => state.setInitialized);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      queryClient.invalidateQueries();
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (userData: { email: string; name: string; password: string }): Promise<AuthResponse> => {
      const response = await api.post('/auth/register', userData);
      return response.data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      queryClient.invalidateQueries();
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
    },
    onError: () => {
      // Even if API request fails, clear local credentials
      clearAuth();
      queryClient.clear();
    },
  });

  // Verify session on app load
  const verifySession = async () => {
    try {
      const accessToken = useAuthStore.getState().accessToken;
      if (accessToken) {
        // Fetch current user details
        const response = await api.get('/auth/me');
        setAuth(response.data.user, accessToken);
      } else {
        // Try to run a token refresh (in case accessToken was cleared, but refresh token cookie is still valid)
        const refreshResponse = await api.post('/auth/refresh');
        const { user: refreshedUser, accessToken: newAccessToken } = refreshResponse.data;
        setAuth(refreshedUser, newAccessToken);
      }
    } catch (error) {
      clearAuth();
    } finally {
      setInitialized(true);
    }
  };

  return {
    user,
    isAuthenticated,
    isInitialized,
    verifySession,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
