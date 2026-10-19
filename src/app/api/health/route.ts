import { NextResponse } from "next/server";
import { hasRedisConfig } from "@/lib/redis/client";

export const runtime = "nodejs";

export function GET() {
  const redis = hasRedisConfig();
  return NextResponse.json({
    ok: true,
    storage: redis ? "redis" : "memory",
    productionReady: redis,
    realtime: "websocket",
  });
}
