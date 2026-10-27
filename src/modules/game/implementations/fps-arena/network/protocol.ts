import { z } from "zod";
import type { FpsInput, FpsVector3 } from "../engine/rules";
import type { RuntimeCombatEvent, RuntimeSnapshot } from "../engine/simulation";

const vectorSchema = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });
const inputSchema = z.object({
  forward: z.number().min(-1).max(1),
  strafe: z.number().min(-1).max(1),
  sprint: z.boolean(),
  jump: z.boolean(),
  yaw: z.number().finite(),
  pitch: z.number().finite(),
  seq: z.number().int().nonnegative(),
});
const snapshotSchema = z.object({
  version: z.literal(1),
  sequence: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
  players: z.array(z.object({
    id: z.string().min(8).max(100),
    position: vectorSchema,
    velocity: vectorSchema,
    rotation: z.object({ yaw: z.number().finite(), pitch: z.number().finite() }),
    hp: z.number().min(0).max(100),
    alive: z.boolean(),
    kills: z.number().int().nonnegative(),
    deaths: z.number().int().nonnegative(),
    respawnAt: z.number().int().nonnegative().nullable(),
  })).max(6),
});
const combatSchema = z.object({
  eventId: z.string().min(1).max(100),
  shooterId: z.string().min(8).max(100),
  targetId: z.string().min(8).max(100).nullable(),
  damage: z.number().int().min(0).max(100),
  remainingHealth: z.number().int().min(0).max(100).nullable(),
  killed: z.boolean(),
  timestamp: z.number().int().nonnegative(),
});

export const peerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), playerId: z.string().min(8).max(100), nickname: z.string().min(2).max(20) }),
  z.object({ type: z.literal("input"), input: inputSchema }),
  z.object({ type: z.literal("snapshot"), snapshot: snapshotSchema }),
  z.object({ type: z.literal("fire"), eventId: z.string().min(1).max(100), direction: vectorSchema, timestamp: z.number().int().nonnegative() }),
  z.object({ type: z.literal("combat"), event: combatSchema }),
  z.object({ type: z.literal("resync") }),
  z.object({ type: z.literal("host-paused"), paused: z.boolean() }),
]);

export type PeerMessage = z.infer<typeof peerMessageSchema>;
export type InputPayload = FpsInput;
export type VectorPayload = FpsVector3;
export type SnapshotPayload = RuntimeSnapshot;
export type CombatPayload = RuntimeCombatEvent;

export function encodePeerMessage(message: PeerMessage): string {
  return JSON.stringify(message);
}

export function decodePeerMessage(value: string): PeerMessage | null {
  try {
    const parsed = peerMessageSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
