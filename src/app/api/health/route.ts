import { NextResponse } from "next/server";
import { checkRedisHealth, hasRedisConfig, isLocalMemoryFallbackAllowed } from "@/lib/redis/client";

export const runtime = "nodejs";

export async function GET() {
  if (!hasRedisConfig()) {
    const memoryAllowed = isLocalMemoryFallbackAllowed();
    return NextResponse.json({
      ok: memoryAllowed,
      storage: "memory",
      productionReady: false,
      realtime: "websocket",
      error: memoryAllowed ? undefined : { code: "REDIS_REQUIRED", message: "REDIS_URL chưa được cấu hình cho môi trường production." },
    }, { status: memoryAllowed ? 200 : 503 });
  }

  const healthy = await checkRedisHealth();
  return NextResponse.json({
    ok: healthy,
    storage: "redis",
    productionReady: healthy,
    realtime: "websocket",
    error: healthy ? undefined : { code: "REDIS_UNAVAILABLE", message: "Không thể kết nối Redis production." },
  }, { status: healthy ? 200 : 503 });
}
