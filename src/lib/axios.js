import axios from "axios";

/**
 * Centralized Axios instance for all client-side HTTP requests.
 * Configured with interceptors, default headers, timeout, and global error handling.
 */
const api = axios.create({
  baseURL: "",  // Same-origin — Next.js API routes
  timeout: 30000, // 30s timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Request Interceptor ────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Authorization is handled by NextAuth session cookies (httpOnly),
    // so no manual token injection is needed for same-origin API routes.
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ─── Response Interceptor ───────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    // Axios auto-parses JSON — return response directly
    return response;
  },
  (error) => {
    // Global error handling
    if (error.response) {
      const { status } = error.response;

      if (status === 401) {
        console.warn("[Axios] Unauthorized — session may have expired.");
      } else if (status === 403) {
        console.warn("[Axios] Forbidden — insufficient permissions.");
      } else if (status >= 500) {
        console.error("[Axios] Server error:", status, error.response.data);
      }
    } else if (error.request) {
      console.error("[Axios] Network error — no response received:", error.message);
    } else {
      console.error("[Axios] Request setup error:", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
