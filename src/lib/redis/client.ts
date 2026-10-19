import Redis from "ioredis";

let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL;
  if (!url) {
    client = null;
    if (process.env.NODE_ENV !== "production") console.warn("[MiniPlay] REDIS_URL chưa có — đang chạy local-only với memory store.");
    return client;
  }
  client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  });
  return client;
}

export function hasRedisConfig(): boolean {
  return Boolean(process.env.REDIS_URL);
}
