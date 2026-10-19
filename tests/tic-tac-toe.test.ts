import { describe, expect, it } from "vitest";
import { ticTacToeEngine } from "@/modules/game/implementations/tic-tac-toe/engine";

const players = ["player-a", "player-b"];

describe("tic-tac-toe engine", () => {
  it("creates a clean board and assigns symbols", () => {
    const state = ticTacToeEngine.createInitialState(players);
    expect(state.board).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(state.players).toEqual({ "player-a": "X", "player-b": "O" });
    expect(state.currentPlayerId).toBe("player-a");
  });

  it("rejects invalid, occupied, and out-of-turn moves", () => {
    const state = ticTacToeEngine.createInitialState(players);
    expect(() => ticTacToeEngine.applyAction(state, { type: "place-mark", payload: { position: 9 } }, "player-a")).toThrow();
    const after = ticTacToeEngine.applyAction(state, { type: "place-mark", payload: { position: 0 } }, "player-a");
    expect(() => ticTacToeEngine.applyAction(after, { type: "place-mark", payload: { position: 0 } }, "player-b")).toThrow();
    expect(() => ticTacToeEngine.applyAction(after, { type: "place-mark", payload: { position: 1 } }, "player-a")).toThrow();
  });

  it("detects a win, a draw, and reset", () => {
    let state = ticTacToeEngine.createInitialState(players);
    for (const [player, position] of [["player-a", 0], ["player-b", 3], ["player-a", 1], ["player-b", 4], ["player-a", 2]] as const) {
      state = ticTacToeEngine.applyAction(state, { type: "place-mark", payload: { position } }, player);
    }
    expect(ticTacToeEngine.getResult(state)).toEqual({ finished: true, winnerId: "player-a", isDraw: false });
    expect(state.winningLine).toEqual([0, 1, 2]);

    let draw = ticTacToeEngine.createInitialState(players);
    for (const [player, position] of [["player-a", 0], ["player-b", 1], ["player-a", 2], ["player-b", 4], ["player-a", 3], ["player-b", 5], ["player-a", 7], ["player-b", 6], ["player-a", 8]] as const) {
      draw = ticTacToeEngine.applyAction(draw, { type: "place-mark", payload: { position } }, player);
    }
    expect(ticTacToeEngine.getResult(draw)).toEqual({ finished: true, winnerId: null, isDraw: true });
    expect(ticTacToeEngine.reset(players).board.every((cell) => cell === null)).toBe(true);
  });
});
