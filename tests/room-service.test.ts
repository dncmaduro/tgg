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

  it("rejects missing rooms and full rooms", async () => {
    const service = new RoomService(new MemoryRoomStore());
    await expect(service.getSnapshot("000000")).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
    const room = await service.createRoom("tic-tac-toe", identity("one", "One"));
    await service.joinRoom(room.code, identity("two", "Two"));
    await expect(service.joinRoom(room.code, identity("three", "Three"))).rejects.toMatchObject({ code: "ROOM_FULL" });
  });
});
