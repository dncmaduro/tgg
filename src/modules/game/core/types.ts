import type { GameState, PlayerSymbol, TicTacToeState } from "@/types/domain";

export type GameAction = {
  type: string;
  payload: unknown;
};

export type GameResult = {
  finished: boolean;
  winnerId: string | null;
  isDraw: boolean;
};

export type GameEngine<State extends GameState = GameState> = {
  readonly id: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  createInitialState(playerIds: string[], now?: number): State;
  applyAction(state: State, action: GameAction, playerId: string, now?: number): State;
  getResult(state: State): GameResult;
  reset(playerIds: string[]): State;
  toPublicState(state: State, _viewerId?: string): State;
  advance?(state: State, now: number): State;
  onPlayerLeave?(state: State, playerId: string, now: number): State;
};

export type AnyGameEngine = GameEngine<any>;

export const isPlayerSymbol = (value: unknown): value is PlayerSymbol => value === "X" || value === "O";
