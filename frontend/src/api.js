import axios from 'axios';

// In production the frontend is served by the same Express server,
// so /api calls go to the same origin. In dev, Vite proxies /api → localhost:5000.
const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

// ── Attach token from localStorage on every request ──────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Handle 401 globally ───────────────────────────────────────────────────────
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
