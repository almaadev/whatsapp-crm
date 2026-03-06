import Redis from "ioredis";

const globalForRedis = global;

const createRedisClient = () => {

  if (!process.env.REDIS_URL) {
    return {
      status: "disabled",
      get: async () => null,
      set: async () => null,
      del: async () => null,
      on: () => {},
    };
  }

  const client = new Redis(process.env.REDIS_URL, {
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    lazyConnect: true,
  });

  client.on("error", (err) => {

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