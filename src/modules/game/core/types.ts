import type { PlayerSymbol, TicTacToeState } from "@/types/domain";

export type GameAction = {
  type: string;
  payload: unknown;
};

export type GameResult = {
  finished: boolean;
  winnerId: string | null;
  isDraw: boolean;
};

export type GameEngine = {
  readonly id: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  createInitialState(playerIds: string[]): TicTacToeState;
  applyAction(state: TicTacToeState, action: GameAction, playerId: string): TicTacToeState;
  getResult(state: TicTacToeState): GameResult;
  reset(playerIds: string[]): TicTacToeState;
  toPublicState(state: TicTacToeState, _viewerId?: string): TicTacToeState;
};

export const isPlayerSymbol = (value: unknown): value is PlayerSymbol => value === "X" || value === "O";
