import type { GameAction, GameEngine } from "@/modules/game/core/types";
import type { PlayerSymbol, TicTacToeState } from "@/types/domain";

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function assignSymbols(playerIds: string[]): Record<string, PlayerSymbol> {
  return Object.fromEntries(playerIds.slice(0, 2).map((id, index) => [id, index === 0 ? "X" : "O"]));
}

function findResult(state: TicTacToeState): { winnerId: string | null; line: number[]; draw: boolean } {
  for (const line of winningLines) {
    const [a, b, c] = line;
    const symbol = state.board[a];
    if (symbol && symbol === state.board[b] && symbol === state.board[c]) {
      const winnerId = Object.entries(state.players).find(([, value]) => value === symbol)?.[0] ?? null;
      return { winnerId, line, draw: false };
    }
  }
  return { winnerId: null, line: [], draw: state.board.every(Boolean) };
}

export const ticTacToeEngine: GameEngine = {
  id: "tic-tac-toe",
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(playerIds) {
    if (playerIds.length !== 2) throw new Error("Caro mini cần đúng 2 người chơi.");
    return {
      board: Array.from({ length: 9 }, () => null),
      players: assignSymbols(playerIds),
      currentPlayerId: playerIds[0],
      winnerId: null,
      winningLine: [],
      isDraw: false,
    };
  },

  applyAction(state, action: GameAction, playerId) {
    if (action.type !== "place-mark") throw new Error("Hành động không được hỗ trợ.");
    if (state.winnerId || state.isDraw) throw new Error("Ván chơi đã kết thúc.");
    if (!state.players[playerId]) throw new Error("Bạn không thuộc ván chơi này.");
    if (state.currentPlayerId !== playerId) throw new Error("Chưa đến lượt của bạn.");

    const position = typeof action.payload === "object" && action.payload !== null && "position" in action.payload
      ? (action.payload as { position?: unknown }).position
      : undefined;
    if (typeof position !== "number" || !Number.isInteger(position) || position < 0 || position > 8) {
      throw new Error("Ô cờ không hợp lệ.");
    }
    if (state.board[position]) throw new Error("Ô cờ đã được đánh.");

    const board = [...state.board];
    board[position] = state.players[playerId];
    const next: TicTacToeState = {
      ...state,
      board,
      currentPlayerId: Object.keys(state.players).find((id) => id !== playerId) ?? playerId,
    };
    const result = findResult(next);
    return {
      ...next,
      winnerId: result.winnerId,
      winningLine: result.line,
      isDraw: result.draw,
    };
  },

  getResult(state) {
    return { finished: Boolean(state.winnerId) || state.isDraw, winnerId: state.winnerId, isDraw: state.isDraw };
  },

  reset(playerIds) {
    return this.createInitialState(playerIds);
  },

  toPublicState(state) {
    return state;
  },
};
