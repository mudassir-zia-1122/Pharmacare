import axios from 'axios';

// Vite proxy routes /api to http://localhost:5000/api in development
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
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

    const message =
      error.response?.data?.message ||
      error.message ||
      'Network communication error with server';

    const customErr = new Error(message);
    customErr.response = error.response;
    customErr.status = error.response?.status;
    return Promise.reject(customErr);
  }
);

export default apiClient;
