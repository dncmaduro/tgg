import { describe, expect, it } from "vitest";
import { wordChainEngine, WORD_CHAIN_TURN_MS, WORD_CHAIN_VOTING_MS } from "@/modules/game/implementations/word-chain/engine";
import { normalizeWord } from "@/modules/game/implementations/word-chain/normalization";
import { validateWord } from "@/modules/game/implementations/word-chain/validator";

const players = ["player-a", "player-b", "player-c", "player-d"];
const now = 1_000_000;
const context = { requiredSyllable: null, usedWords: new Set<string>() };

describe("word-chain validator", () => {
  it("normalizes Vietnamese Unicode and whitespace without removing accents", () => {
    expect(normalizeWord("  HỌC   SINH  ")).toBe("học sinh");
    expect(normalizeWord("quản lý")).toBe("quản lí");
    expect(validateWord("HỌC   SINH", context)).toMatchObject({ code: "VALID", word: "học sinh" });
  });

  it("checks format, connection, duplicates, blocked words, and dictionary membership", () => {
    expect(validateWord("học sinh viên", context).code).toBe("INVALID_FORMAT");
    expect(validateWord("chó chết", context).code).toBe("BLOCKED_WORD");
    expect(validateWord("học qwerty", context).code).toBe("NOT_IN_DICTIONARY");
    expect(validateWord("sinh viên", { ...context, requiredSyllable: "học" }).code).toBe("INVALID_CONNECTION");
    expect(validateWord("học sinh", { ...context, usedWords: new Set(["học sinh"]) }).code).toBe("ALREADY_USED");
  });
});

describe("word-chain engine", () => {
  it("accepts connected words and keeps the turn server-side", () => {
    let state = wordChainEngine.createInitialState(players.slice(0, 2), now);
    state = wordChainEngine.applyAction(state, { type: "submit-word", payload: { word: "học sinh" } }, "player-a", now + 1);
    expect(state.currentPlayerId).toBe("player-b");
    expect(state.requiredSyllable).toBe("sinh");
    expect(state.wordHistory[0]).toMatchObject({ word: "học sinh", playerId: "player-a" });
    expect(() => wordChainEngine.applyAction(state, { type: "submit-word", payload: { word: "sinh viên" } }, "player-a", now + 2)).toThrowError(/Chưa đến lượt/);
    state = wordChainEngine.applyAction(state, { type: "submit-word", payload: { word: "sinh viên" } }, "player-b", now + 3);
    expect(state.currentWord).toBe("sinh viên");
  });

  it("opens a challenge only for a missing dictionary word and accepts a valid vote", () => {
    let state = wordChainEngine.createInitialState(players.slice(0, 2), now);
    state = wordChainEngine.applyAction(state, { type: "submit-word", payload: { word: "học sinh" } }, "player-a", now + 1);
    state = wordChainEngine.applyAction(state, { type: "challenge", payload: { word: "sinh qwerty" } }, "player-b", now + 2);
    expect(state.phase).toBe("VOTING");
    expect(state.pendingChallenge?.word).toBe("sinh qwerty");
    state = wordChainEngine.applyAction(state, { type: "vote", payload: { vote: "VALID" } }, "player-a", now + 3);
    expect(state.phase).toBe("TURN");
    expect(state.currentPlayerId).toBe("player-a");
    expect(state.wordHistory.at(-1)).toMatchObject({ word: "sinh qwerty", acceptedViaChallenge: true });
  });

  it("rejects a challenge, preserves the proposer turn, and prevents a second challenge", () => {
    let state = wordChainEngine.createInitialState(players.slice(0, 2), now);
    state = wordChainEngine.applyAction(state, { type: "submit-word", payload: { word: "học sinh" } }, "player-a", now + 1);
    state = wordChainEngine.applyAction(state, { type: "challenge", payload: { word: "sinh qwerty" } }, "player-b", now + 2);
    state = wordChainEngine.applyAction(state, { type: "vote", payload: { vote: "INVALID" } }, "player-a", now + 3);
    expect(state.phase).toBe("TURN");
    expect(state.currentPlayerId).toBe("player-b");
    expect(state.challengeUsedThisTurn).toBe(true);
    expect((state.turnDeadline ?? 0) - (now + 3)).toBeGreaterThanOrEqual(5_000);
    expect(() => wordChainEngine.applyAction(state, { type: "challenge", payload: { word: "sinh zzz" } }, "player-b", now + 4)).toThrowError(/đã dùng quyền thách thức/);
  });

  it("counts a strict majority, rejects duplicate and unauthorized votes, and handles voting timeout", () => {
    let state = wordChainEngine.createInitialState(players, now);
    state = wordChainEngine.applyAction(state, { type: "submit-word", payload: { word: "học sinh" } }, "player-a", now + 1);
    state = wordChainEngine.applyAction(state, { type: "challenge", payload: { word: "sinh qwerty" } }, "player-b", now + 2);
    expect(() => wordChainEngine.applyAction(state, { type: "vote", payload: { vote: "VALID" } }, "player-b", now + 3)).toThrowError(/không được bỏ phiếu/);
    state = wordChainEngine.applyAction(state, { type: "vote", payload: { vote: "VALID" } }, "player-a", now + 4);
    expect(() => wordChainEngine.applyAction(state, { type: "vote", payload: { vote: "VALID" } }, "player-a", now + 5)).toThrowError(/đã bỏ phiếu/);
    state = wordChainEngine.applyAction(state, { type: "vote", payload: { vote: "INVALID" } }, "player-c", now + 6);
    expect(state.phase).toBe("VOTING");
    state = wordChainEngine.advance!(state, now + 6 + WORD_CHAIN_VOTING_MS + 1);
    expect(state.phase).toBe("TURN");
    expect(state.currentPlayerId).toBe("player-b");
  });

  it("eliminates timed-out players, finds a winner, and handles a leaving player", () => {
    let state = wordChainEngine.createInitialState(players.slice(0, 2), now);
    state = wordChainEngine.advance!(state, now + WORD_CHAIN_TURN_MS + 1);
    expect(state.eliminatedPlayerIds).toEqual(["player-a"]);
    expect(state.phase).toBe("FINISHED");
    expect(state.winnerId).toBe("player-b");

    const leaving = wordChainEngine.createInitialState(players.slice(0, 3), now);
    const afterLeave = wordChainEngine.onPlayerLeave?.(leaving, "player-a", now + 1);
    expect(afterLeave?.currentPlayerId).toBe("player-b");
    expect(afterLeave?.eliminatedPlayerIds).toContain("player-a");
  });
});
