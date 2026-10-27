import { z } from "zod";
import type { RoomSnapshot } from "@/types/domain";

export const MAX_WEBSOCKET_MESSAGE_BYTES = 8 * 1024;

export const identitySchema = z.object({
  playerId: z.string().min(8).max(100),
  credential: z.string().min(8).max(200),
  nickname: z.string().min(2).max(20),
});

export const webrtcSignalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("offer"), sdp: z.string().min(1).max(16_000) }),
  z.object({ kind: z.literal("answer"), sdp: z.string().min(1).max(16_000) }),
  z.object({ kind: z.literal("ice"), candidate: z.string().max(4_000), sdpMid: z.string().max(200).nullable().optional(), sdpMLineIndex: z.number().int().min(0).max(128).nullable().optional() }),
]);

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("room:subscribe"), code: z.string().regex(/^\d{6}$/), identity: identitySchema }),
  z.object({ type: z.literal("room:leave"), code: z.string().regex(/^\d{6}$/), identity: identitySchema }),
  z.object({ type: z.literal("webrtc:signal"), code: z.string().regex(/^\d{6}$/), identity: identitySchema, targetPlayerId: z.string().min(8).max(100), signal: webrtcSignalSchema }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ServerMessage =
  | { type: "room:subscribed"; room: RoomSnapshot }
  | { type: "room:updated"; room: RoomSnapshot }
  | { type: "webrtc:signal"; code: string; fromPlayerId: string; signal: z.infer<typeof webrtcSignalSchema> }
  | { type: "system:error"; code: string; message: string };

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
