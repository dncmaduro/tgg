import { describe, expect, it } from "vitest";
import { clientMessageSchema } from "@/modules/realtime/protocol";

describe("realtime protocol", () => {
  it("accepts a subscribe message", () => {
    const parsed = clientMessageSchema.parse({ type: "room:subscribe", code: "123456", identity: { playerId: "player-123", credential: "credential-123", nickname: "Mèo" } });
    expect(parsed.type).toBe("room:subscribe");
  });

  it("rejects malformed codes and identity payloads", () => {
    expect(() => clientMessageSchema.parse({ type: "room:subscribe", code: "123", identity: { playerId: "x", credential: "y", nickname: "A" } })).toThrow();
  });
});
