import type { RoomRecord } from "@/types/domain";

export type Mutation<T> = { room: RoomRecord; result: T };

export interface RoomStore {
  get(code: string): Promise<RoomRecord | null>;
  create(room: RoomRecord): Promise<void>;
  mutate<T>(code: string, mutator: (room: RoomRecord) => Mutation<T>): Promise<T>;
  remove(code: string): Promise<void>;
}
