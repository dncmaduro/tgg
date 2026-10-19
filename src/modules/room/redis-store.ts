import { AppError } from "@/lib/errors";
import { getRedis } from "@/lib/redis/client";
import type { RoomRecord } from "@/types/domain";
import type { Mutation, RoomStore } from "@/modules/room/store";

const PREFIX = "miniplay:room:v1:";
const TTL_SECONDS = 60 * 60 * 12;

export class RedisRoomStore implements RoomStore {
  private readonly redis = getRedis();

  constructor() {
    if (!this.redis) throw new Error("RedisRoomStore cần REDIS_URL.");
  }

  async get(code: string): Promise<RoomRecord | null> {
    const raw = await this.redis!.get(this.key(code));
    if (!raw) return null;
    return JSON.parse(raw) as RoomRecord;
  }

  async create(room: RoomRecord): Promise<void> {
    const created = await this.redis!.set(this.key(room.code), JSON.stringify(room), "EX", TTL_SECONDS, "NX");
    if (created !== "OK") throw new AppError("ROOM_CODE_CONFLICT", "Mã phòng đã tồn tại.", 409);
  }

  async mutate<T>(code: string, mutator: (room: RoomRecord) => Mutation<T>): Promise<T> {
    const key = this.key(code);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await this.redis!.watch(key);
      const raw = await this.redis!.get(key);
      if (!raw) {
        await this.redis!.unwatch();
        throw new AppError("ROOM_NOT_FOUND", "Không tìm thấy phòng.", 404);
      }
      const current = JSON.parse(raw) as RoomRecord;
      const next = mutator(current);
      const transaction = this.redis!.multi().set(key, JSON.stringify(next.room), "EX", TTL_SECONDS);
      const result = await transaction.exec();
      if (result) return next.result;
    }
    throw new AppError("ROOM_BUSY", "Phòng đang có quá nhiều thay đổi đồng thời, hãy thử lại.", 409);
  }

  async remove(code: string): Promise<void> {
    await this.redis!.del(this.key(code));
  }

  private key(code: string): string {
    return `${PREFIX}${code}`;
  }
}
