import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { hasRedisConfig } from "@/lib/redis/client";
import { AppError, isAppError } from "@/lib/errors";
import { getRoomService } from "@/modules/room/service-singleton";
import { identitySchema } from "@/modules/realtime/protocol";

const createSchema = z.object({ gameId: z.string(), identity: identitySchema });
const gameActionSchema = z.object({ type: z.string().min(1).max(40), payload: z.unknown() });
const mutationSchema = z.object({
  intent: z.enum(["join", "ready", "start", "action", "restart", "leave"]),
  identity: identitySchema,
  ready: z.boolean().optional(),
  action: gameActionSchema.optional(),
});

export async function handleLocalApi(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] === "ws") return false;

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      return send(response, 200, { ok: true, storage: hasRedisConfig() ? "redis" : "memory", productionReady: hasRedisConfig(), realtime: "websocket" });
    }
    const service = getRoomService();
    if (request.method === "POST" && url.pathname === "/api/rooms") {
      const body = createSchema.parse(await readJson(request));
      return send(response, 201, { room: await service.createRoom(body.gameId, body.identity) });
    }
    if (parts[1] === "rooms" && parts[2] && request.method === "GET" && parts.length === 3) {
      return send(response, 200, { room: await service.getSnapshot(parts[2]) });
    }
    if (parts[1] === "rooms" && parts[2] && parts[3] === "actions" && request.method === "POST") {
      const body = mutationSchema.parse(await readJson(request));
      const code = parts[2];
      if (body.intent === "join") return send(response, 200, { room: await service.joinRoom(code, body.identity) });
      if (body.intent === "ready") return send(response, 200, { room: await service.setReady(code, body.identity, body.ready ?? true) });
      if (body.intent === "start") return send(response, 200, { room: await service.startGame(code, body.identity) });
      if (body.intent === "restart") return send(response, 200, { room: await service.restartGame(code, body.identity) });
      if (body.intent === "leave") return send(response, 200, { room: await service.leaveRoom(code, body.identity) });
      if (!body.action) throw new AppError("INVALID_INPUT", "Thiếu action.");
      return send(response, 200, { room: await service.applyAction(code, body.identity, body.action) });
    }
    return false;
  } catch (error) {
    if (isAppError(error)) return send(response, error.status, { error: { code: error.code, message: error.message } });
    if (error instanceof z.ZodError) return send(response, 400, { error: { code: "INVALID_INPUT", message: "Dữ liệu gửi lên không hợp lệ." } });
    if (error instanceof Error && error.message.includes("REDIS_URL")) return send(response, 503, { error: { code: "REDIS_REQUIRED", message: "Redis chưa được cấu hình cho môi trường production." } });
    return send(response, 500, { error: { code: "INTERNAL_ERROR", message: "Đã có lỗi xảy ra." } });
  }
}

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new AppError("INVALID_INPUT", "Body JSON không hợp lệ.")); }
    });
    request.on("error", reject);
  });
}

function send(response: ServerResponse, status: number, body: unknown): boolean {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
  return true;
}
