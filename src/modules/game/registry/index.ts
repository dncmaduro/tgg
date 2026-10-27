import type { GameId } from "@/types/domain";
import type { AnyGameEngine } from "@/modules/game/core/types";

export type GameDefinition = {
  id: GameId;
  title: string;
  description: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  status: "available" | "coming-soon";
  category?: "board" | "word" | "action";
  engine?: AnyGameEngine;
};

export const gameRegistry: GameDefinition[] = [
  {
    id: "word-chain",
    title: "Nối từ",
    description: "2–10 người, mỗi lượt 15 giây.",
    icon: "↔",
    minPlayers: 2,
    maxPlayers: 10,
    status: "available",
  },
  {
    id: "tic-tac-toe",
    title: "Caro mini",
    description: "Bàn 3×3, 2 người.",
    icon: "✦",
    minPlayers: 2,
    maxPlayers: 2,
    status: "available",
  },
  {
    id: "fps-arena",
    title: "FPS Arena",
    description: "Đấu súng góc nhìn thứ nhất, 2–6 người.",
    icon: "⊙",
    minPlayers: 2,
    maxPlayers: 6,
    status: "available",
    category: "action",
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
