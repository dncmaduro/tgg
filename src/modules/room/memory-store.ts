import { AppError } from "@/lib/errors";
import type { RoomRecord } from "@/types/domain";
import type { Mutation, RoomStore } from "@/modules/room/store";

type MemoryState = { rooms: Map<string, RoomRecord> };

function getSharedRooms(): Map<string, RoomRecord> {
  if (process.env.NODE_ENV === "test") return new Map<string, RoomRecord>();
  const globalState = globalThis as typeof globalThis & { __miniplayMemoryState?: MemoryState };
  globalState.__miniplayMemoryState ??= { rooms: new Map<string, RoomRecord>() };
  return globalState.__miniplayMemoryState.rooms;
}

export class MemoryRoomStore implements RoomStore {
  private readonly rooms = getSharedRooms();
  private readonly mutationLocks = new Map<string, Promise<void>>();

  async get(code: string): Promise<RoomRecord | null> {
    const room = this.rooms.get(code);
    if (!room) return null;
    if (room.expiresAt <= Date.now()) {
      this.rooms.delete(code);
      return null;
    }
    return structuredClone(room);
  }

  async create(room: RoomRecord): Promise<void> {
    if (this.rooms.has(room.code)) throw new AppError("ROOM_CODE_CONFLICT", "Mã phòng đã tồn tại.", 409);
    this.rooms.set(room.code, structuredClone(room));
  }

  async mutate<T>(code: string, mutator: (room: RoomRecord) => Mutation<T>): Promise<T> {
    const previous = this.mutationLocks.get(code) ?? Promise.resolve();
    let release!: () => void;
    const currentLock = new Promise<void>((resolve) => { release = resolve; });
    this.mutationLocks.set(code, currentLock);
    await previous;
    try {
      const current = await this.get(code);
      if (!current) throw new AppError("ROOM_NOT_FOUND", "Không tìm thấy phòng.", 404);
      const next = mutator(current);
      this.rooms.set(code, structuredClone(next.room));
      return next.result;
    } finally {
      release();
      if (this.mutationLocks.get(code) === currentLock) this.mutationLocks.delete(code);
    }
  }

  async remove(code: string): Promise<void> {
    this.rooms.delete(code);
  }
}
