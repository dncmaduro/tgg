import { createHash, randomInt } from "node:crypto";
import { AppError } from "@/lib/errors";
import { publishRoomEvent } from "@/modules/realtime/event-bus";
import { getGameDefinition } from "@/modules/game/registry";
import { getSupportedGame } from "@/modules/game/registry/server";
import type { GameAction, AnyGameEngine } from "@/modules/game/core/types";
import type { GameId, GameState, PlayerRecord, RoomRecord, RoomSnapshot } from "@/types/domain";
import type { RoomStore } from "@/modules/room/store";

const ROOM_TTL_MS = 12 * 60 * 60 * 1_000;

export type IdentityInput = { playerId: string; credential: string; nickname: string };

function hashCredential(credential: string): string {
  return createHash("sha256").update(credential).digest("hex");
}

function normalizeNickname(nickname: string): string {
  const value = nickname.trim().replace(/\s+/g, " ").slice(0, 20);
  if (value.length < 2) throw new AppError("INVALID_NICKNAME", "Nickname cần ít nhất 2 ký tự.");
  return value;
}

function normalizeCode(code: string): string {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) throw new AppError("INVALID_ROOM_CODE", "Mã phòng phải gồm 6 chữ số.");
  return normalized;
}

function makeCode(): string {
  return randomInt(100000, 1_000_000).toString();
}

function authorize(room: RoomRecord, identity: IdentityInput): PlayerRecord {
  const player = room.players.find((candidate) => candidate.id === identity.playerId);
  if (!player || player.credentialHash !== hashCredential(identity.credential)) throw new AppError("UNAUTHORIZED_PLAYER", "Phiên người chơi không hợp lệ.", 403);
  return player;
}

function snapshot(room: RoomRecord): RoomSnapshot {
  const game = getGameDefinition(room.gameId);
  if (!game) throw new AppError("GAME_NOT_FOUND", "Không tìm thấy trò chơi.", 404);
  return {
    code: room.code,
    gameId: room.gameId,
    gameTitle: game.title,
    gameDescription: game.description,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    status: room.status,
    hostId: room.hostId,
    players: room.players.map(({ credentialHash: _credentialHash, ...player }) => player),
    gameState: room.gameState ? getSupportedGame(room.gameId).engine.toPublicState(room.gameState) : null,
    revision: room.revision,
    expiresAt: room.expiresAt,
  };
}

export class RoomService {
  constructor(private readonly store: RoomStore) {}

  async getSnapshot(code: string): Promise<RoomSnapshot> {
    const normalizedCode = normalizeCode(code);
    await this.settleExpired(normalizedCode);
    const room = await this.store.get(normalizedCode);
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Không tìm thấy phòng.", 404);
    return snapshot(room);
  }

  async createRoom(gameId: string, identity: IdentityInput): Promise<RoomSnapshot> {
    const game = getSupportedGame(gameId);
    const nickname = normalizeNickname(identity.nickname);
    let lastConflict: unknown;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const now = Date.now();
      const code = makeCode();
      const room: RoomRecord = {
        code,
        gameId: game.id,
        status: "WAITING",
        hostId: identity.playerId,
        players: [{
          id: identity.playerId,
          nickname,
          credentialHash: hashCredential(identity.credential),
          isHost: true,
          ready: false,
          connected: true,
          lastSeenAt: now,
          joinedAt: now,
        }],
        gameState: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + ROOM_TTL_MS,
      };
      try {
        await this.store.create(room);
        const result = snapshot(room);
        console.info("[MiniPlay room] created", { code: room.code, gameId: room.gameId, playerId: identity.playerId });
        await publishRoomEvent(result);
        return result;
      } catch (error) {
        lastConflict = error;
        if (!(error instanceof AppError) || error.code !== "ROOM_CODE_CONFLICT") throw error;
      }
    }
    throw lastConflict instanceof Error ? lastConflict : new AppError("ROOM_CODE_CONFLICT", "Không thể tạo mã phòng.", 409);
  }

  async joinRoom(code: string, identity: IdentityInput): Promise<RoomSnapshot> {
    const normalizedCode = normalizeCode(code);
    const nickname = normalizeNickname(identity.nickname);
    const result = await this.store.mutate(normalizedCode, (room) => {
      const now = Date.now();
      const existing = room.players.find((player) => player.id === identity.playerId);
      if (existing) {
        if (existing.credentialHash !== hashCredential(identity.credential)) throw new AppError("UNAUTHORIZED_PLAYER", "Phiên người chơi không hợp lệ.", 403);
        existing.nickname = nickname;
        existing.connected = true;
        existing.lastSeenAt = now;
      } else {
        const game = getSupportedGame(room.gameId);
        if (room.status !== "WAITING") throw new AppError("ROOM_NOT_JOINABLE", "Ván chơi đã bắt đầu; chỉ người chơi cũ mới được kết nối lại.");
        if (room.players.length >= game.maxPlayers) throw new AppError("ROOM_FULL", "Phòng đã đủ người.", 409);
        room.players.push({
          id: identity.playerId,
          nickname,
          credentialHash: hashCredential(identity.credential),
          isHost: false,
          ready: false,
          connected: true,
          lastSeenAt: now,
          joinedAt: now,
        });
      }
      room.updatedAt = now;
      room.revision += 1;
      return { room, result: snapshot(room) };
    });
    await publishRoomEvent(result);
    return result;
  }

  async setReady(code: string, identity: IdentityInput, ready: boolean): Promise<RoomSnapshot> {
    return this.mutateAuthorized(code, identity, (room, player) => {
      if (room.status !== "WAITING") throw new AppError("ROOM_NOT_WAITING", "Phòng không còn ở trạng thái chờ.");
      player.ready = ready;
      player.connected = true;
      return room;
    });
  }

  async startGame(code: string, identity: IdentityInput): Promise<RoomSnapshot> {
    const result = await this.mutateAuthorized(code, identity, (room, player) => {
      const game = getSupportedGame(room.gameId);
      if (!player.isHost || room.hostId !== player.id) throw new AppError("HOST_ONLY", "Chỉ host mới có thể bắt đầu.", 403);
      if (room.status !== "WAITING") throw new AppError("ROOM_NOT_WAITING", "Phòng không còn ở trạng thái chờ.");
      if (room.players.length < game.minPlayers) throw new AppError("NOT_ENOUGH_PLAYERS", `Cần ít nhất ${game.minPlayers} người chơi.`);
      if (!room.players.every((candidate) => candidate.ready)) throw new AppError("PLAYERS_NOT_READY", "Tất cả người chơi cần sẵn sàng trước.");
      room.status = "PLAYING";
      room.gameState = game.engine.createInitialState(room.players.map((candidate) => candidate.id), Date.now());
      return room;
    });
    console.info("[MiniPlay game] started", { code: result.code, gameId: result.gameId, players: result.players.length });
    return result;
  }

  async applyAction(code: string, identity: IdentityInput, action: GameAction): Promise<RoomSnapshot> {
    const result = await this.mutateAuthorized(code, identity, (room, player) => {
      const game = getSupportedGame(room.gameId);
      if (!room.gameState || room.status === "WAITING") throw new AppError("GAME_NOT_PLAYING", "Ván chơi chưa bắt đầu hoặc đã kết thúc.");
      const now = Date.now();
      const before = room.gameState;
      const isFpsControlAction = game.id === "fps-arena" && (action.type === "fps-begin-match" || action.type === "fps-finish-match");
      if (isFpsControlAction && !player.isHost) throw new AppError("HOST_ONLY", "Chỉ host mới có thể điều khiển vòng FPS.", 403);
      const advanced = game.engine.advance ? game.engine.advance(before, now) : before;
      room.gameState = advanced;
      updateRoomStatus(room, game.engine);
      if (isFpsControlAction) {
        room.gameState = game.engine.applyAction(action.type === "fps-finish-match" ? before : advanced, action, player.id, now);
        updateRoomStatus(room, game.engine);
        return room;
      }
      if (advanced !== before) return room;
      if (room.status !== "PLAYING") throw new AppError("GAME_NOT_PLAYING", "Ván chơi chưa bắt đầu hoặc đã kết thúc.");
      room.gameState = game.engine.applyAction(room.gameState, action, player.id, now);
      updateRoomStatus(room, game.engine);
      return room;
    });
    if (result.status === "FINISHED") console.info("[MiniPlay game] ended", { code: result.code, gameId: result.gameId, revision: result.revision });
    return result;
  }

  async restartGame(code: string, identity: IdentityInput): Promise<RoomSnapshot> {
    return this.mutateAuthorized(code, identity, (room, player) => {
      if (!player.isHost) throw new AppError("HOST_ONLY", "Chỉ host mới có thể chơi lại.", 403);
      if (room.status !== "FINISHED") throw new AppError("GAME_NOT_FINISHED", "Ván chơi chưa kết thúc.");
      room.players.forEach((candidate) => { candidate.ready = false; });
      room.gameState = null;
      room.status = "WAITING";
      return room;
    });
  }

  async leaveRoom(code: string, identity: IdentityInput): Promise<RoomSnapshot | null> {
    const normalizedCode = normalizeCode(code);
    const current = await this.store.get(normalizedCode);
    if (!current) return null;
    authorize(current, identity);
    if (current.players.length === 1) {
      await this.store.remove(normalizedCode);
      return null;
    }
    const result = await this.store.mutate(normalizedCode, (room) => {
      const player = authorize(room, identity);
      const game = room.gameState ? getSupportedGame(room.gameId) : undefined;
      if (game?.engine.onPlayerLeave && room.gameState) {
        room.gameState = game.engine.onPlayerLeave(room.gameState, player.id, Date.now());
        updateRoomStatus(room, game.engine);
      }
      room.players = room.players.filter((candidate) => candidate.id !== player.id);
      if (room.hostId === player.id) {
        const nextHost = room.players[0];
        if (nextHost) {
          room.hostId = nextHost.id;
          room.players = room.players.map((candidate, index) => ({ ...candidate, isHost: index === 0 }));
        }
      }
      room.updatedAt = Date.now();
      room.revision += 1;
      return { room, result: snapshot(room) };
    });
    await publishRoomEvent(result);
    return result;
  }

  async markConnected(code: string, identity: IdentityInput, connected: boolean): Promise<RoomSnapshot> {
    await this.settleExpired(normalizeCode(code));
    return this.mutateAuthorized(code, identity, (room, player) => {
      player.connected = connected;
      player.lastSeenAt = Date.now();
      return room;
    });
  }

  private async mutateAuthorized(code: string, identity: IdentityInput, mutate: (room: RoomRecord, player: PlayerRecord) => RoomRecord): Promise<RoomSnapshot> {
    const normalizedCode = normalizeCode(code);
    const result = await this.store.mutate(normalizedCode, (room) => {
      const player = authorize(room, identity);
      const nextRoom = mutate(room, player);
      nextRoom.updatedAt = Date.now();
      nextRoom.revision += 1;
      return { room: nextRoom, result: snapshot(nextRoom) };
    });
    await publishRoomEvent(result);
    return result;
  }

  private async settleExpired(code: string): Promise<void> {
    const current = await this.store.get(code);
    if (!current?.gameState) return;
    const currentGame = getSupportedGame(current.gameId);
    if (!currentGame.engine.advance) return;
    let changed = false;
    const result = await this.store.mutate(code, (room) => {
      if (!room.gameState) return { room, result: snapshot(room) };
      const game = getSupportedGame(room.gameId);
      if (!game.engine.advance) return { room, result: snapshot(room) };
      const nextState = game.engine.advance(room.gameState, Date.now());
      if (nextState === room.gameState) return { room, result: snapshot(room) };
      room.gameState = nextState;
      updateRoomStatus(room, game.engine);
      changed = true;
      return { room, result: snapshot(room) };
    });
    if (changed) await publishRoomEvent(result);
  }
}

function updateRoomStatus(room: RoomRecord, engine: AnyGameEngine): void {
  if (!room.gameState) return;
  const result = engine.getResult(room.gameState);
  room.status = result.finished ? "FINISHED" : "PLAYING";
}

export { hashCredential, normalizeNickname, normalizeCode };
