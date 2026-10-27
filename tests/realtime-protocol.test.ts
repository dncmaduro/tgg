import { describe, expect, it } from "vitest";
import { clientMessageSchema } from "@/modules/realtime/protocol";

describe("realtime protocol", () => {
  it("accepts a subscribe message", () => {
    const parsed = clientMessageSchema.parse({ type: "room:subscribe", code: "123456", identity: { playerId: "player-123", credential: "credential-123", nickname: "Mèo" } });
    expect(parsed.type).toBe("room:subscribe");
  });

  it("rejects malformed codes and identity payloads", () => {
    expect(() => clientMessageSchema.parse({ type: "room:subscribe", code: "123", identity: { playerId: "x", credential: "y", nickname: "A" } })).toThrow();
    expect(() => clientMessageSchema.parse({ type: "room:subscribe", code: "12ab34", identity: { playerId: "player-123", credential: "credential-123", nickname: "Mèo" } })).toThrow();
  });

  it("validates room-scoped WebRTC signaling payloads", () => {
    const parsed = clientMessageSchema.parse({ type: "webrtc:signal", code: "123456", targetPlayerId: "player-target", identity: { playerId: "player-source", credential: "credential-123", nickname: "Mèo" }, signal: { kind: "offer", sdp: "v=0" } });
    expect(parsed.type).toBe("webrtc:signal");
    expect(() => clientMessageSchema.parse({ type: "webrtc:signal", code: "123456", targetPlayerId: "player-target", identity: { playerId: "player-source", credential: "credential-123", nickname: "Mèo" }, signal: { kind: "offer", sdp: "" } })).toThrow();
  });
});
