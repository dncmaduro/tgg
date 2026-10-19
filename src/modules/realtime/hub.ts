import { subscribeToRoomEvents, type RoomEvent } from "@/modules/realtime/event-bus";
import { encodeServerMessage, type ServerMessage } from "@/modules/realtime/protocol";

export type SocketLike = { send(data: string): void; readyState?: number };

export class RealtimeHub {
  private readonly rooms = new Map<string, Set<SocketLike>>();
  private readonly socketRooms = new Map<SocketLike, string>();

  constructor() {
    subscribeToRoomEvents((event) => this.onRoomEvent(event));
  }

  add(code: string, socket: SocketLike): void {
    const room = this.rooms.get(code) ?? new Set<SocketLike>();
    room.add(socket);
    this.rooms.set(code, room);
    this.socketRooms.set(socket, code);
  }

  remove(socket: SocketLike): string | undefined {
    const code = this.socketRooms.get(socket);
    if (!code) return undefined;
    const room = this.rooms.get(code);
    room?.delete(socket);
    if (room && room.size === 0) this.rooms.delete(code);
    this.socketRooms.delete(socket);
    return code;
  }

  send(socket: SocketLike, message: ServerMessage): void {
    socket.send(encodeServerMessage(message));
  }

  broadcast(code: string, message: ServerMessage): void {
    const sockets = this.rooms.get(code);
    if (!sockets) return;
    const encoded = encodeServerMessage(message);
    for (const socket of sockets) {
      try {
        socket.send(encoded);
      } catch {
        this.remove(socket);
      }
    }
  }

  private onRoomEvent(event: RoomEvent): void {
    this.broadcast(event.room.code, { type: "room:updated", room: event.room });
  }
}

let hub: RealtimeHub | undefined;

export function getRealtimeHub(): RealtimeHub {
  if (!hub) hub = new RealtimeHub();
  return hub;
}
