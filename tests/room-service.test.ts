import { describe, expect, it } from "vitest";
import { MemoryRoomStore } from "@/modules/room/memory-store";
import { RoomService } from "@/modules/room/room-service";

const identity = (playerId: string, nickname: string) => ({ playerId, credential: `${playerId}-credential`, nickname });

describe("room service", () => {
  it("creates, joins, readies, starts and reconnects without duplicate players", async () => {
    const service = new RoomService(new MemoryRoomStore());
    const host = identity("player-host", "Host");
    const guest = identity("player-guest", "Guest");
    const created = await service.createRoom("tic-tac-toe", host);
    expect(created.code).toMatch(/^\d{6}$/);
    const joined = await service.joinRoom(created.code, guest);
    expect(joined.players).toHaveLength(2);
    const reconnected = await service.joinRoom(created.code, guest);
    expect(reconnected.players).toHaveLength(2);
    await service.setReady(created.code, host, true);
    await service.setReady(created.code, guest, true);
    const playing = await service.startGame(created.code, host);
    expect(playing.status).toBe("PLAYING");
    expect(playing.gameState?.players[host.playerId]).toBe("X");
  });

  it("keeps host-only start and transfers host on leave", async () => {
    const service = new RoomService(new MemoryRoomStore());
    const host = identity("host-2", "Host");
    const guest = identity("guest-2", "Guest");
    const room = await service.createRoom("tic-tac-toe", host);
    await service.joinRoom(room.code, guest);
    await expect(service.startGame(room.code, guest)).rejects.toMatchObject({ code: "HOST_ONLY" });
    const afterLeave = await service.leaveRoom(room.code, host);
    expect(afterLeave?.hostId).toBe(guest.playerId);
    expect(afterLeave?.players.find((player) => player.id === guest.playerId)?.isHost).toBe(true);
  });

  it("tracks disconnect and reconnect presence without duplicating a player", async () => {
    const service = new RoomService(new MemoryRoomStore());
    const host = identity("presence-host", "Host");
    const guest = identity("presence-guest", "Guest");
    const room = await service.createRoom("tic-tac-toe", host);
    await service.joinRoom(room.code, guest);

    const disconnected = await service.markConnected(room.code, guest, false);
    expect(disconnected.players.find((player) => player.id === guest.playerId)?.connected).toBe(false);

    const reconnected = await service.markConnected(room.code, guest, true);
    expect(reconnected.players).toHaveLength(2);
    expect(reconnected.players.find((player) => player.id === guest.playerId)?.connected).toBe(true);
  });

  it("keeps room state isolated and rejects credential spoofing", async () => {
    const service = new RoomService(new MemoryRoomStore());
    const hostA = identity("isolation-host-a", "Host A");
    const guestA = identity("isolation-guest-a", "Guest A");
    const hostB = identity("isolation-host-b", "Host B");
    const roomA = await service.createRoom("tic-tac-toe", hostA);
    const roomB = await service.createRoom("tic-tac-toe", hostB);
    await service.joinRoom(roomA.code, guestA);

    await service.setReady(roomA.code, hostA, true);
    expect((await service.getSnapshot(roomA.code)).players.find((player) => player.id === hostA.playerId)?.ready).toBe(true);
    expect((await service.getSnapshot(roomB.code)).players.find((player) => player.id === hostB.playerId)?.ready).toBe(false);
    await expect(service.joinRoom(roomA.code, { ...hostA, credential: "wrong-credential" })).rejects.toMatchObject({ code: "UNAUTHORIZED_PLAYER" });
    await expect(service.startGame(roomA.code, guestA)).rejects.toMatchObject({ code: "HOST_ONLY" });
  });

  it("finishes a game once, blocks further moves, and allows host rematch", async () => {
    const service = new RoomService(new MemoryRoomStore());
    const host = identity("lifecycle-host", "Host");
    const guest = identity("lifecycle-guest", "Guest");
    const room = await service.createRoom("tic-tac-toe", host);
    await service.joinRoom(room.code, guest);
    await service.setReady(room.code, host, true);
    await service.setReady(room.code, guest, true);
    await service.startGame(room.code, host);

    for (const [player, position] of [[host, 0], [guest, 3], [host, 1], [guest, 4], [host, 2]] as const) {
      await service.applyAction(room.code, player, { type: "place-mark", payload: { position } });
    }
    expect((await service.getSnapshot(room.code)).status).toBe("FINISHED");
    await expect(service.applyAction(room.code, guest, { type: "place-mark", payload: { position: 5 } })).rejects.toMatchObject({ code: "GAME_NOT_PLAYING" });
    await expect(service.restartGame(room.code, guest)).rejects.toMatchObject({ code: "HOST_ONLY" });
    expect((await service.restartGame(room.code, host)).status).toBe("WAITING");
  });

  it("rejects missing rooms and full rooms", async () => {
    const service = new RoomService(new MemoryRoomStore());
    await expect(service.getSnapshot("12ab34")).rejects.toMatchObject({ code: "INVALID_ROOM_CODE" });
    await expect(service.getSnapshot("000000")).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
    const room = await service.createRoom("tic-tac-toe", identity("one", "One"));
    await service.joinRoom(room.code, identity("two", "Two"));
    await expect(service.joinRoom(room.code, identity("three", "Three"))).rejects.toMatchObject({ code: "ROOM_FULL" });
  });
});
