import { AppError, isAppError } from "@/lib/errors";
import { getRoomService } from "@/modules/room/service-singleton";
import { getRealtimeHub, type SocketLike } from "@/modules/realtime/hub";
import { clientMessageSchema, type ClientMessage } from "@/modules/realtime/protocol";

const subscriptions = new WeakMap<SocketLike, { code: string; identity: ClientMessage["identity"] }>();

export function registerSocket(socket: SocketLike): void {
  // Registration is synchronous so a join frame sent immediately after open is not dropped.
  void socket;
}

export async function receiveSocketMessage(socket: SocketLike, raw: string): Promise<void> {
  const hub = getRealtimeHub();
  let message: ClientMessage;
  try {
    message = clientMessageSchema.parse(JSON.parse(raw));
  } catch {
    hub.send(socket, { type: "system:error", code: "INVALID_MESSAGE", message: "Tin nhắn realtime không hợp lệ." });
    return;
  }

  const service = getRoomService();
  try {
    if (message.type === "room:subscribe") {
      const room = await service.markConnected(message.code, message.identity, true);
      hub.add(room.code, socket);
      subscriptions.set(socket, { code: room.code, identity: message.identity });
      hub.send(socket, { type: "room:subscribed", room });
      return;
    }

    if (message.type === "room:leave") {
      const room = await service.leaveRoom(message.code, message.identity);
      hub.remove(socket);
      subscriptions.delete(socket);
      if (room) hub.broadcast(room.code, { type: "room:updated", room });
    }
  } catch (error) {
    const appError = isAppError(error) ? error : new AppError("INTERNAL_ERROR", "Không thể xử lý realtime.", 500);
    hub.send(socket, { type: "system:error", code: appError.code, message: appError.message });
  }
}

export function unregisterSocket(socket: SocketLike): void {
  const subscription = subscriptions.get(socket);
  const hub = getRealtimeHub();
  hub.remove(socket);
  subscriptions.delete(socket);
  if (subscription) void getRoomService().markConnected(subscription.code, subscription.identity, false).catch(() => undefined);
}
