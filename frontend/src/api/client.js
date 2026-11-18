import axios from 'axios';

// Vite proxy routes /api to http://localhost:5000/api in development;
// In production (Vercel), set VITE_API_BASE_URL=https://<render-service>.onrender.com/api/v1
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');

/**
 * Extracts the backend server origin (scheme + host + optional port) from API_BASE_URL.
 * Returns '' for relative paths (local Vite proxy).
 */
export function getBackendOrigin(apiBaseUrl = API_BASE_URL) {
  if (!apiBaseUrl) return '';
  if (/^https?:\/\//i.test(apiBaseUrl)) {
    try {
      return new URL(apiBaseUrl).origin;
    } catch {
      return '';
    }
  }
  return '';
}

export const BACKEND_ORIGIN = getBackendOrigin(API_BASE_URL);

/**
 * Resolves a backend-relative media URL (e.g. /uploads/doctors/doc_123.jpg) to an
 * absolute URL pointing at the configured backend API origin in deployed environments.
 * Passes full http(s), data:, and blob: URLs through unchanged.
 */
export function resolveMediaUrl(url, apiBaseUrl = API_BASE_URL) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  const origin = getBackendOrigin(apiBaseUrl);
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // 60s timeout safely accommodates Render Free tier cold starts (typically 30-50s after idle)
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pharma_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle unified API responses and 401s
apiClient.interceptors.response.use(
  (response) => {
    // Return the response data directly
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      const isAuthEndpoint =
        error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth/firebase-login');

      if (!isAuthEndpoint) {
        // Token expired or invalid: clear session
        localStorage.removeItem('pharma_token');
        localStorage.removeItem('pharma_user');
        localStorage.removeItem('pharma_mode');
        localStorage.removeItem('pharma_provider');
        // Redirect to login if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    let message =
      error.response?.data?.message ||
      error.message ||
      'Network communication error with server';

    // Provide helpful guidance on Render Free cold-start delays without triggering infinite retries
    if (error.code === 'ECONNABORTED' || message.toLowerCase().includes('timeout')) {
      message =
        'The server is waking up or taking longer than expected to respond. Please wait a few seconds and try again.';
    } else if (!error.response && error.request) {
      message =
        'Unable to reach the backend server. It may be starting up or temporarily offline — please try again shortly.';
    }

    const customErr = new Error(message);
    customErr.response = error.response;
    customErr.status = error.response?.status;
    customErr.isColdStartOrNetworkError = !error.response || error.code === 'ECONNABORTED';
    return Promise.reject(customErr);
  }
);

export default apiClient;
