import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { getRedis } from "@/lib/redis/client";
import type { RoomSnapshot } from "@/types/domain";

const STREAM_KEY = "miniplay:room-events:v1";
const INSTANCE_ID = randomUUID();

export type RoomEvent = { type: "room.updated"; room: RoomSnapshot; sourceId: string };
type Listener = (event: RoomEvent) => void;
type EventState = { listeners: Set<Listener> };

const globalState = globalThis as typeof globalThis & { __miniplayEventState?: EventState };
globalState.__miniplayEventState ??= { listeners: new Set<Listener>() };
const localListeners = globalState.__miniplayEventState.listeners;
let relayStarted = false;
let relayClient: Redis | null = null;
let relayCursor = "$";

export function subscribeToRoomEvents(listener: Listener): () => void {
  localListeners.add(listener);
  startRedisRelay();
  return () => localListeners.delete(listener);
}

export async function publishRoomEvent(room: RoomSnapshot): Promise<void> {
  const event: RoomEvent = { type: "room.updated", room, sourceId: INSTANCE_ID };
  for (const listener of localListeners) listener(event);
  const redis = getRedis();
  if (redis) await redis.xadd(STREAM_KEY, "*", "payload", JSON.stringify(event));
}

function startRedisRelay(): void {
  if (relayStarted || !getRedis()) return;
  relayStarted = true;
  void runRedisRelay();
}

async function runRedisRelay(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  relayClient = redis.duplicate();

  while (relayClient) {
    try {
      const response = await relayClient.xread("BLOCK", 5_000, "STREAMS", STREAM_KEY, relayCursor) as unknown;
      if (!Array.isArray(response)) continue;
      const streams = response[0];
      if (!Array.isArray(streams)) continue;
      const entries = streams[1];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!Array.isArray(entry) || typeof entry[0] !== "string" || !Array.isArray(entry[1])) continue;
        relayCursor = entry[0];
        const fields = entry[1];
        const payloadIndex = fields.findIndex((field) => field === "payload");
        const payload = payloadIndex >= 0 ? fields[payloadIndex + 1] : undefined;
        if (typeof payload !== "string") continue;
        const event = JSON.parse(payload) as RoomEvent;
        if (event.sourceId === INSTANCE_ID) continue;
        for (const listener of localListeners) listener(event);
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
}
