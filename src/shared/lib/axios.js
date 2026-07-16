import axios from "axios";

/**
 * Enterprise API Client
 * Configured with interceptors, timeouts, cancellation, and retry logic.
 */

const MAX_RETRIES = 3;

const api = axios.create({
  baseURL: "", // Same-origin Next.js API routes
  timeout: 30000, // 30s timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Request Interceptor ────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Add default cancellation token if not present
    if (!config.signal && typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      config.signal = controller.signal;
      // We could store the controller somewhere to cancel it, but usually callers pass their own
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ─── Response Interceptor ───────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    // Returns the full Axios response payload so `{ data } = await api.get(...)` continues to work
    return response;
  },
  async (error) => {
    const config = error.config;
    
    // 1. Retry Logic for transient 5xx errors or network failures
    // Idempotent methods usually (GET/PUT/DELETE) but we can apply cautiously
    if (config && (!config._retryCount || config._retryCount < MAX_RETRIES)) {
      const isNetworkError = error.message === 'Network Error' || error.code === 'ECONNABORTED';
      const isServerError = error.response && error.response.status >= 500;
      
      if (isNetworkError || isServerError) {
        config._retryCount = (config._retryCount || 0) + 1;
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, config._retryCount - 1) * 1000;
        
        console.warn(`[API] Retrying request (${config._retryCount}/${MAX_RETRIES}) after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return api(config);
      }
    }

    // 2. Cancellation Check
    if (axios.isCancel(error)) {
      console.warn("[API] Request was cancelled:", error.message);
      // Normalized cancellation error
      return Promise.reject({
        message: "Request cancelled",
        isCancelled: true,
      });
    }

    // 3. Error Normalization
    const status = error.response?.status;
    const errorData = error.response?.data;
    
    if (status === 401) {
      console.warn("[API] Unauthorized — session may have expired.");
    } else if (status === 403) {
      console.warn("[API] Forbidden — insufficient permissions.");
      if (errorData?.error === "Suspended" || errorData?.message === "Suspended") {
        try {
          const { useUserStore } = require("@/features/user/store/userStore");
          useUserStore.setState({ isSuspended: true });
        } catch (e) {
          console.error("[API] Failed to update store suspension state:", e);
        }
      }
    }

    const errorMsg = errorData?.error || errorData?.message || error.message || "An unknown error occurred";
    const normalizedError = new Error(errorMsg);
    normalizedError.status = status || 500;
    normalizedError.code = error.code;
    normalizedError.data = errorData || null;
    normalizedError.isCancelled = false;

    // Keep it as a rejected promise so UI try/catch blocks function identically
    return Promise.reject(normalizedError);
  }
);

export default api;
