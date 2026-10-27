import { ticTacToeEngine } from "@/modules/game/implementations/tic-tac-toe/engine";
import type { GameEngine } from "@/modules/game/core/types";
import type { GameId } from "@/types/domain";

export type GameDefinition = {
  id: GameId;
  title: string;
  description: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  status: "available" | "coming-soon";
  engine?: GameEngine;
};

export const gameRegistry: GameDefinition[] = [
  {
    id: "tic-tac-toe",
    title: "Caro mini",
    description: "Bàn 3×3, 2 người.",
    icon: "✦",
    minPlayers: 2,
    maxPlayers: 2,
    status: "available",
    engine: ticTacToeEngine,
  },
  {
    id: "caro",
    title: "Caro 15×15",
    description: "Bàn 15×15, 2 người.",
    icon: "⌁",
    minPlayers: 2,
    maxPlayers: 2,
    status: "coming-soon",
  },
  {
    id: "uno",
    title: "UNO",
    description: "Từ 2 đến 8 người.",
    icon: "◈",
    minPlayers: 2,
    maxPlayers: 8,
    status: "coming-soon",
  },
  {
    id: "chess",
    title: "Cờ vua",
    description: "Bàn cờ, 2 người.",
    icon: "♞",
    minPlayers: 2,
    maxPlayers: 2,
    status: "coming-soon",
  },
  {
    id: "werewolf",
    title: "Ma sói",
    description: "Từ 5 đến 10 người.",
    icon: "☾",
    minPlayers: 5,
    maxPlayers: 10,
    status: "coming-soon",
  },
];

export function getGameDefinition(gameId: string): GameDefinition | undefined {
  return gameRegistry.find((game) => game.id === gameId);
}

export function getSupportedGame(gameId: string): GameDefinition & { engine: GameEngine } {
  const game = getGameDefinition(gameId);
  if (!game || game.status !== "available" || !game.engine) throw new Error("Trò chơi chưa được hỗ trợ.");
  return game as GameDefinition & { engine: GameEngine };
}
