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
    description: "Trận đấu 3×3 gọn, căng và đủ để phục thù ngay ván sau.",
    icon: "✦",
    minPlayers: 2,
    maxPlayers: 2,
    status: "available",
    engine: ticTacToeEngine,
  },
  {
    id: "caro",
    title: "Caro 15×15",
    description: "Xâu 5 quân liên tiếp trong bàn đấu lớn hơn.",
    icon: "⌁",
    minPlayers: 2,
    maxPlayers: 2,
    status: "coming-soon",
  },
  {
    id: "uno",
    title: "UNO",
    description: "Bốc bài, đổi màu và hét UNO đúng lúc.",
    icon: "◈",
    minPlayers: 2,
    maxPlayers: 8,
    status: "coming-soon",
  },
  {
    id: "chess",
    title: "Cờ vua",
    description: "Một bàn cờ cổ điển cho những nước đi không vội.",
    icon: "♞",
    minPlayers: 2,
    maxPlayers: 2,
    status: "coming-soon",
  },
  {
    id: "werewolf",
    title: "Ma sói",
    description: "Bí mật, suy luận và những cú bluff lúc nửa đêm.",
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
