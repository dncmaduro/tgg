import { randomUUID } from "node:crypto";
import { AppError, isAppError } from "@/lib/errors";
import { getRoomService } from "@/modules/room/service-singleton";
import { getRealtimeHub, type SocketLike } from "@/modules/realtime/hub";
import { clientMessageSchema, MAX_WEBSOCKET_MESSAGE_BYTES, type ClientMessage } from "@/modules/realtime/protocol";

const subscriptions = new WeakMap<SocketLike, { code: string; identity: ClientMessage["identity"] }>();
const connectionIds = new WeakMap<SocketLike, string>();

function debugRealtime(message: string, ...values: unknown[]): void {
  if (process.env.MINIPLAY_WS_DEBUG === "1") console.error(`[MiniPlay ws] ${message}`, ...values);
}

export function registerSocket(socket: SocketLike): void {
  // Registration is synchronous so a join frame sent immediately after open is not dropped.
  const connectionId = randomUUID();
  connectionIds.set(socket, connectionId);
  console.info("[MiniPlay ws] opened", { connectionId });
}

export async function receiveSocketMessage(socket: SocketLike, raw: string): Promise<void> {
  const hub = getRealtimeHub();
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > MAX_WEBSOCKET_MESSAGE_BYTES) {
    debugRealtime("oversized client frame", { bytes });
    hub.send(socket, { type: "system:error", code: "MESSAGE_TOO_LARGE", message: "Tin nhắn realtime quá lớn." });
    socket.close?.(1009, "Message too large");
    return;
  }
  let message: ClientMessage;
  try {
    message = clientMessageSchema.parse(JSON.parse(raw));
  } catch {
    debugRealtime("invalid client frame", { bytes: raw.length });
    hub.send(socket, { type: "system:error", code: "INVALID_MESSAGE", message: "Tin nhắn realtime không hợp lệ." });
    return;
  }

  debugRealtime("client frame", { type: message.type, code: message.code, playerId: message.identity.playerId });

  const service = getRoomService();
  try {
    if (message.type === "room:subscribe") {
      const previous = subscriptions.get(socket);
      if (previous && previous.code !== message.code) {
        void service.markConnected(previous.code, previous.identity, false).catch(() => undefined);
      }
      const room = await service.markConnected(message.code, message.identity, true);
      hub.add(room.code, socket, message.identity.playerId);
      subscriptions.set(socket, { code: room.code, identity: message.identity });
      debugRealtime("subscribe ok", { code: room.code, players: room.players.length, revision: room.revision });
      debugRealtime("sending subscribed", { readyState: socket.readyState });
      hub.send(socket, { type: "room:subscribed", room });
      return;
    }

    if (message.type === "webrtc:signal") {
      const subscription = subscriptions.get(socket);
      if (!subscription || subscription.code !== message.code || subscription.identity.playerId !== message.identity.playerId || subscription.identity.credential !== message.identity.credential) {
        throw new AppError("UNAUTHORIZED_PLAYER", "Phiên người chơi không hợp lệ.", 403);
      }
      const room = await service.getSnapshot(message.code);
      if (!room.players.some((player) => player.id === message.targetPlayerId)) {
        throw new AppError("PLAYER_NOT_IN_ROOM", "Người chơi đích không ở trong phòng.", 403);
      }
      hub.sendToPlayer(room.code, message.targetPlayerId, {
        type: "webrtc:signal",
        code: room.code,
        fromPlayerId: message.identity.playerId,
        signal: message.signal,
      });
      return;
    }

    if (message.type === "room:leave") {
      const room = await service.leaveRoom(message.code, message.identity);
      hub.remove(socket);
      subscriptions.delete(socket);
      debugRealtime("leave ok", { code: message.code });
      if (room) hub.broadcast(room.code, { type: "room:updated", room });
    }
  } catch (error) {
    const appError = isAppError(error) ? error : new AppError("INTERNAL_ERROR", "Không thể xử lý realtime.", 500);
    if (!isAppError(error)) console.error("[MiniPlay ws] unexpected handler error", { connectionId: connectionIds.get(socket), message: error instanceof Error ? error.message : "unknown error" });
    debugRealtime("handler error", { code: appError.code, message: appError.message });
    hub.send(socket, { type: "system:error", code: appError.code, message: appError.message });
  }
}

export function unregisterSocket(socket: SocketLike): void {
  const subscription = subscriptions.get(socket);
  const hub = getRealtimeHub();
  hub.remove(socket);
  subscriptions.delete(socket);
  const connectionId = connectionIds.get(socket);
  connectionIds.delete(socket);
  console.info("[MiniPlay ws] closed", { connectionId, code: subscription?.code });
  debugRealtime("socket unregistered", subscription ? { code: subscription.code, playerId: subscription.identity.playerId } : undefined);
  if (subscription) void getRoomService().markConnected(subscription.code, subscription.identity, false).catch(() => undefined);
}
