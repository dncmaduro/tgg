import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { attachRedisClientDiagnostics, getRedis } from "@/lib/redis/client";
import type { RoomSnapshot } from "@/types/domain";

const STREAM_KEY = "miniplay:room-events:v1";
const STREAM_MAX_LENGTH = 5_000;
const RELAY_BLOCK_MS = 30_000;
const INSTANCE_ID = randomUUID();

export type RoomEvent = { type: "room.updated"; room: RoomSnapshot; sourceId: string };
type Listener = (event: RoomEvent) => void;
type EventState = { listeners: Set<Listener> };
type RelaySession = { client: Redis; stopped: boolean };

const globalState = globalThis as typeof globalThis & { __miniplayEventState?: EventState };
globalState.__miniplayEventState ??= { listeners: new Set<Listener>() };
const localListeners = globalState.__miniplayEventState.listeners;
let relaySession: RelaySession | null = null;
let relayCursor = "$";

export function subscribeToRoomEvents(listener: Listener): () => void {
  localListeners.add(listener);
  startRedisRelay();
  return () => {
    localListeners.delete(listener);
    if (localListeners.size === 0) stopRedisRelay();
  };
}

export async function publishRoomEvent(room: RoomSnapshot): Promise<void> {
  const event: RoomEvent = { type: "room.updated", room, sourceId: INSTANCE_ID };
  for (const listener of localListeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("[MiniPlay realtime] local listener failed", { message: error instanceof Error ? error.message : "unknown error" });
    }
  }
  const redis = getRedis();
  if (redis) {
    await redis.xadd(STREAM_KEY, "MAXLEN", "~", STREAM_MAX_LENGTH, "*", "payload", JSON.stringify(event));
  }
}

function startRedisRelay(): void {
  if (relaySession || !getRedis()) return;
  const client = attachRedisClientDiagnostics(getRedis()!.duplicate(), "relay");
  const session: RelaySession = { client, stopped: false };
  relaySession = session;
  void runRedisRelay(session).finally(() => {
    if (relaySession === session) relaySession = null;
  });
}

function stopRedisRelay(): void {
  const session = relaySession;
  if (!session) return;
  session.stopped = true;
  relaySession = null;
  session.client.disconnect();
}

async function runRedisRelay(session: RelaySession): Promise<void> {
  while (!session.stopped && localListeners.size > 0) {
    try {
      const response = await session.client.xread("BLOCK", RELAY_BLOCK_MS, "STREAMS", STREAM_KEY, relayCursor) as unknown;
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
        let event: RoomEvent;
        try {
          event = JSON.parse(payload) as RoomEvent;
        } catch {
          console.error("[MiniPlay realtime] ignored malformed Redis event");
          continue;
        }
        if (event.sourceId === INSTANCE_ID) continue;
        for (const listener of localListeners) {
          try {
            listener(event);
          } catch (error) {
            console.error("[MiniPlay realtime] relay listener failed", { message: error instanceof Error ? error.message : "unknown error" });
          }
        }
      }
    } catch (error) {
      if (session.stopped) return;
      console.error("[MiniPlay realtime] Redis relay read failed", { message: error instanceof Error ? error.message : "unknown error" });
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
}
