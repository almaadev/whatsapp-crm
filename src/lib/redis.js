import Redis from "ioredis";

// Use a singleton to prevent multiple instances in dev
const globalForRedis = global;

const createRedisClient = () => {
  // 1. CHECK: If no environment variable is set, return a "Dummy" client
  // This prevents the app from trying to connect to localhost:6379
  if (!process.env.REDIS_URL) {
    // console.log("⚠️ No REDIS_URL found. Caching is disabled."); // Optional log
    return {
      status: "disabled",
      get: async () => null, // Always returns "Cache Miss"
      set: async () => null, // Does nothing
      del: async () => null, // Does nothing
      on: () => {},          // No event listeners
    };
  }

  // 2. REAL CLIENT: Only created if REDIS_URL exists
  const client = new Redis(process.env.REDIS_URL, {
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    lazyConnect: true,
  });

  client.on("error", (err) => {
    // Silently handle connection errors if the provided URL is wrong
    if (err.code !== "ECONNREFUSED") {
        console.warn("Redis Error:", err.message);
    }
  });

  return client;
};

// Initialize only once
if (!globalForRedis.redis) {
  globalForRedis.redis = createRedisClient();
}

const redis = globalForRedis.redis;

export default redis;