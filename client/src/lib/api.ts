/// <reference types="vite/client" />
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

// Compute base URL dynamically from Vite environment variables
const rawApiUrl = import.meta.env.VITE_API_URL || '';
const hasV1 = rawApiUrl.endsWith('/v1') || rawApiUrl.endsWith('/v1/');
export const baseURL = rawApiUrl 
  ? (hasV1 ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/v1`) 
  : '/api/v1';

// Diagnostic debug logging on startup
console.log('[DocMind API] Configuration Diagnostics:');
console.log('  - Environment VITE_API_URL:', import.meta.env.VITE_API_URL || '(not set)');
console.log('  - Computed Axios baseURL:', baseURL);
console.log('  - Login Endpoint:', `${baseURL}/auth/login`);
console.log('  - Register Endpoint:', `${baseURL}/auth/register`);

// Create API instance
export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests (crucial for refresh token)
});

// Request Interceptor: Attach access token
api.interceptors.request.use(
  (config) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle token refresh on 401
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and request hasn't been retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't refresh if it's already an auth endpoint (except for 'me' or refresh errors)
      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/register') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt silent token refresh
        const refreshResponse = await axios.post(
          '/api/v1/auth/refresh',
          {},
          { withCredentials: true }
        );
        const { accessToken, user } = refreshResponse.data;

        // Save new token in Zustand store
        useAuthStore.getState().setAuth(user, accessToken);

        // Process queue
        processQueue(null, accessToken);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token is expired or invalid
        processQueue(refreshError, null);
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
export default api;
