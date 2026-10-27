export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED" | "CLOSED";

export type GameId = "tic-tac-toe" | "word-chain" | "fps-arena" | "caro" | "uno" | "chess" | "werewolf";

export type PlayerSymbol = "X" | "O";

export type TicTacToeState = {
  board: Array<PlayerSymbol | null>;
  players: Record<string, PlayerSymbol>;
  currentPlayerId: string;
  winnerId: string | null;
  winningLine: number[];
  isDraw: boolean;
};

export type WordChainPhase = "TURN" | "VOTING" | "FINISHED";
export type WordChainVote = "VALID" | "INVALID";

export type WordChainHistoryEntry = {
  word: string;
  playerId: string;
  acceptedViaChallenge: boolean;
};

export type WordChainChallenge = {
  word: string;
  proposerId: string;
  turnNumber: number;
  remainingTurnMs: number;
  votingDeadline: number;
  votes: Record<string, WordChainVote>;
};

export type WordChainState = {
  phase: WordChainPhase;
  playerOrder: string[];
  currentPlayerId: string | null;
  currentWord: string | null;
  requiredSyllable: string | null;
  usedWords: string[];
  wordHistory: WordChainHistoryEntry[];
  eliminatedPlayerIds: string[];
  turnDeadline: number | null;
  remainingTurnMs: number | null;
  pendingChallenge: WordChainChallenge | null;
  winnerId: string | null;
  stateRevision: number;
  turnNumber: number;
  challengeUsedThisTurn: boolean;
  acceptedChallengeWords: string[];
};

export type FpsArenaPhase = "CONNECTING" | "COUNTDOWN" | "PLAYING" | "FINISHED";

export type FpsArenaScore = {
  kills: number;
  deaths: number;
};

export type FpsArenaState = {
  phase: FpsArenaPhase;
  playerIds: string[];
  scores: Record<string, FpsArenaScore>;
  countdownEndsAt: number | null;
  startedAt: number | null;
  endsAt: number | null;
  winnerIds: string[];
  finishReason: "score" | "time" | null;
  stateRevision: number;
};

export type GameState = TicTacToeState | WordChainState | FpsArenaState;

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
  gameState: GameState | null;
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
  minPlayers: number;
  maxPlayers: number;
  status: RoomStatus;
  hostId: string;
  players: PlayerSnapshot[];
  gameState: GameState | null;
  revision: number;
  expiresAt: number;
};
