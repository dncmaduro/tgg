import { hasRedisConfig, isLocalMemoryFallbackAllowed, isProductionRuntime, RedisConfigurationError } from "@/lib/redis/client";
import { MemoryRoomStore } from "@/modules/room/memory-store";
import { RedisRoomStore } from "@/modules/room/redis-store";
import type { RoomStore } from "@/modules/room/store";

let store: RoomStore | undefined;

export function getRoomStore(): RoomStore {
  if (store) return store;
  if (hasRedisConfig()) {
    store = new RedisRoomStore();
    return store;
  }
  if (isProductionRuntime() && !isLocalMemoryFallbackAllowed()) throw new RedisConfigurationError("REDIS_REQUIRED", "REDIS_URL chưa được cấu hình cho môi trường production.");
  store = new MemoryRoomStore();
  return store;
}

export function resetRoomStoreForTests(): void {
  store = undefined;
}
