import { z } from "zod";
import type { RoomSnapshot } from "@/types/domain";

export const identitySchema = z.object({
  playerId: z.string().min(8).max(100),
  credential: z.string().min(8).max(200),
  nickname: z.string().min(2).max(20),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("room:subscribe"), code: z.string().length(6), identity: identitySchema }),
  z.object({ type: z.literal("room:leave"), code: z.string().length(6), identity: identitySchema }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ServerMessage =
  | { type: "room:subscribed"; room: RoomSnapshot }
  | { type: "room:updated"; room: RoomSnapshot }
  | { type: "system:error"; code: string; message: string };

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
