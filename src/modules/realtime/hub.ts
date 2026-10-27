import { subscribeToRoomEvents, type RoomEvent } from "@/modules/realtime/event-bus";
import { encodeServerMessage, type ServerMessage } from "@/modules/realtime/protocol";

export type SocketLike = { send(data: string): void; close?: (code?: number, reason?: string) => void; readyState?: number };

export class RealtimeHub {
  private readonly rooms = new Map<string, Set<SocketLike>>();
  private readonly socketRooms = new Map<SocketLike, string>();
  private readonly socketPlayers = new Map<SocketLike, string>();
  private unsubscribeFromRoomEvents: (() => void) | undefined;

  add(code: string, socket: SocketLike, playerId?: string): void {
    this.remove(socket);
    if (!this.unsubscribeFromRoomEvents) {
      this.unsubscribeFromRoomEvents = subscribeToRoomEvents((event) => this.onRoomEvent(event));
    }
    const room = this.rooms.get(code) ?? new Set<SocketLike>();
    room.add(socket);
    this.rooms.set(code, room);
    this.socketRooms.set(socket, code);
    if (playerId) this.socketPlayers.set(socket, playerId);
  }

  remove(socket: SocketLike): string | undefined {
    const code = this.socketRooms.get(socket);
    if (!code) return undefined;
    const room = this.rooms.get(code);
    room?.delete(socket);
    if (room && room.size === 0) this.rooms.delete(code);
    this.socketRooms.delete(socket);
    this.socketPlayers.delete(socket);
    if (this.socketRooms.size === 0) {
      this.unsubscribeFromRoomEvents?.();
      this.unsubscribeFromRoomEvents = undefined;
    }
    return code;
  }

  send(socket: SocketLike, message: ServerMessage): void {
    try {
      socket.send(encodeServerMessage(message));
    } catch {
      this.remove(socket);
    }
  }

  broadcast(code: string, message: ServerMessage): void {
    const sockets = this.rooms.get(code);
    if (!sockets) return;
    const encoded = encodeServerMessage(message);
    for (const socket of sockets) {
      if (socket.readyState !== undefined && socket.readyState !== 1) {
        this.remove(socket);
        continue;
      }
      try {
        socket.send(encoded);
      } catch {
        this.remove(socket);
      }
    }
  }

  sendToPlayer(code: string, playerId: string, message: ServerMessage): void {
    const sockets = this.rooms.get(code);
    if (!sockets) return;
    for (const socket of sockets) {
      if (this.socketPlayers.get(socket) === playerId) this.send(socket, message);
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
