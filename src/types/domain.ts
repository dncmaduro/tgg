export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED" | "CLOSED";

export type GameId = "tic-tac-toe" | "caro" | "uno" | "chess" | "werewolf";

export type PlayerSymbol = "X" | "O";

export type TicTacToeState = {
  board: Array<PlayerSymbol | null>;
  players: Record<string, PlayerSymbol>;
  currentPlayerId: string;
  winnerId: string | null;
  winningLine: number[];
  isDraw: boolean;
};

export type PlayerRecord = {
  id: string;
  nickname: string;
  credentialHash: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  lastSeenAt: number;
  joinedAt: number;
};

export type RoomRecord = {
  code: string;
  gameId: GameId;
  status: RoomStatus;
  hostId: string;
  players: PlayerRecord[];
  gameState: TicTacToeState | null;
  revision: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

export type PlayerSnapshot = Omit<PlayerRecord, "credentialHash">;

export type RoomSnapshot = {
  code: string;
  gameId: GameId;
  gameTitle: string;
  gameDescription: string;
  status: RoomStatus;
  hostId: string;
  players: PlayerSnapshot[];
  gameState: TicTacToeState | null;
  revision: number;
  expiresAt: number;
};
