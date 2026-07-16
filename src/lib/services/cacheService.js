import redis from "@/lib/db/redis";

export async function getFromCache(key) {
  if (!redis || redis.status !== "ready") return null;
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error(`[Redis] Error getting key ${key}:`, error);
    return null;
  }
}

export async function setInCache(key, data, ttlSeconds = 30) {
  if (!redis || redis.status !== "ready") return false;
  try {
    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
    return true;
  } catch (error) {
    console.error(`[Redis] Error setting key ${key}:`, error);
    return false;
  }
}

export async function invalidateCache(...keys) {
  if (!redis || redis.status !== "ready") return false;
  try {
    await redis.del(...keys);
    return true;
  } catch (error) {
    console.error(`[Redis] Error deleting keys ${keys.join(", ")}:`, error);
    return false;
  }
}
