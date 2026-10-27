import type { AnyGameEngine } from "@/modules/game/core/types";
import { ticTacToeEngine } from "@/modules/game/implementations/tic-tac-toe/engine";
import { wordChainEngine } from "@/modules/game/implementations/word-chain/engine";
import { fpsArenaEngine } from "@/modules/game/implementations/fps-arena/engine/match-state";
import { getGameDefinition, type GameDefinition } from "@/modules/game/registry";
import type { GameId } from "@/types/domain";

const engines: Partial<Record<GameId, AnyGameEngine>> = {
  "tic-tac-toe": ticTacToeEngine,
  "word-chain": wordChainEngine,
  "fps-arena": fpsArenaEngine,
};

export function getSupportedGame(gameId: string): GameDefinition & { engine: AnyGameEngine } {
  const game = getGameDefinition(gameId);
  const engine = game ? engines[game.id] : undefined;
  if (!game || game.status !== "available" || !engine) throw new Error("Trò chơi chưa được hỗ trợ.");
  return { ...game, engine };
}
