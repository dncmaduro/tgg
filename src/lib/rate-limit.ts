import type { IncomingHttpHeaders } from "node:http";
import { AppError } from "@/lib/errors";

type Bucket = { count: number; resetAt: number };
type RateLimitState = { buckets: Map<string, Bucket> };

const globalState = globalThis as typeof globalThis & { __miniplayRateLimitState?: RateLimitState };
globalState.__miniplayRateLimitState ??= { buckets: new Map() };
const buckets = globalState.__miniplayRateLimitState.buckets;

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getRequestAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

export function getIncomingAddress(headers: IncomingHttpHeaders): string {
  return firstHeaderValue(headers["x-forwarded-for"])?.split(",", 1)[0]?.trim()
    || firstHeaderValue(headers["x-real-ip"])?.trim()
    || "unknown";
}

export function enforceRateLimit(scope: string, address: string, limit: number, windowMs: number): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size >= 10_000 && !buckets.has(`${scope}:${address}`)) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }

  const key = `${scope}:${address}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) throw new AppError("RATE_LIMITED", "Có quá nhiều yêu cầu, hãy thử lại sau.", 429);
  current.count += 1;
}
