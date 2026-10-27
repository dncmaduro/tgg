import Redis from "ioredis";

let client: Redis | null | undefined;

export class RedisConfigurationError extends Error {
  constructor(public readonly code: "REDIS_REQUIRED" | "REDIS_CONFIG_INVALID", message: string) {
    super(message);
    this.name = "RedisConfigurationError";
  }
}

function redisUrl(): string | null {
  const value = process.env.REDIS_URL?.trim();
  return value ? value : null;
}

function sanitizeRedisErrorMessage(message: string): string {
  return message.replace(/(rediss?:\/\/)[^\s@]+@/gi, "$1[redacted]@");
}

function logRedisError(scope: string, error: unknown): void {
  const message = error instanceof Error ? sanitizeRedisErrorMessage(error.message) : "unknown error";
  console.error(`[MiniPlay redis] ${scope}`, { message });
}

function attachRedisDiagnostics(redis: Redis, scope: string): Redis {
  redis.on("ready", () => console.info(`[MiniPlay redis] ${scope} ready`));
  redis.on("reconnecting", (delay: number) => console.warn(`[MiniPlay redis] ${scope} reconnecting`, { delayMs: delay }));
  redis.on("error", (error: unknown) => logRedisError(`${scope} connection error`, error));
  return redis;
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export function isLocalMemoryFallbackAllowed(): boolean {
  return !isProductionRuntime() || (process.env.MINIPLAY_LOCAL_E2E === "true" && process.env.VERCEL !== "1");
}

export function validateRedisUrl(): string {
  const url = redisUrl();
  if (!url) throw new RedisConfigurationError("REDIS_REQUIRED", "REDIS_URL is required for production.");
  if (!/^rediss?:\/\//i.test(url)) {
    throw new RedisConfigurationError("REDIS_CONFIG_INVALID", "REDIS_URL must be a Redis TCP/TLS URL starting with redis:// or rediss://; do not use an Upstash REST URL or REST token.");
  }
  return url;
}

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = redisUrl();
  if (!url) {
    client = null;
    if (!isProductionRuntime()) console.warn("[MiniPlay] REDIS_URL chưa có — đang chạy local-only với memory store.");
    return client;
  }
  validateRedisUrl();
  client = attachRedisDiagnostics(new Redis(url, {
    connectTimeout: 5_000,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  }), "primary");
  return client;
}

export function hasRedisConfig(): boolean {
  return Boolean(redisUrl());
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return false;
    return (await redis.ping()) === "PONG";
  } catch (error) {
    logRedisError("health check failed", error);
    return false;
  }
}

export function attachRedisClientDiagnostics(redis: Redis, scope: string): Redis {
  return attachRedisDiagnostics(redis, scope);
}
