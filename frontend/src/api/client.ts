/**
 * PeoplePay585 — API Client
 * Centralized axios instance with auth token injection.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Inject auth token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pp585_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pp585_token');
      localStorage.removeItem('pp585_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    // Globally flatten FastAPI 422 validation error arrays to prevent React rendering crashes
    if (error.response?.data?.detail && Array.isArray(error.response.data.detail)) {
      error.response.data.detail = error.response.data.detail.map((e: any) => e.msg).join(', ');
    }
    
    return Promise.reject(error);
  }
);

export default api;
