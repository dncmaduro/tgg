import { AppError } from "@/lib/errors";
import type { GameAction, GameEngine } from "@/modules/game/core/types";
import type { WordChainHistoryEntry, WordChainState, WordChainVote } from "@/types/domain";
import { normalizeWord } from "@/modules/game/implementations/word-chain/normalization";
import { validateWord, type WordValidationResult } from "@/modules/game/implementations/word-chain/validator";

export const WORD_CHAIN_TURN_MS = 15_000;
export const WORD_CHAIN_VOTING_MS = 10_000;
export const WORD_CHAIN_MIN_RETRY_MS = 5_000;

function activePlayerIds(state: WordChainState): string[] {
  return state.playerOrder.filter((playerId) => !state.eliminatedPlayerIds.includes(playerId));
}

function isActive(state: WordChainState, playerId: string): boolean {
  return state.playerOrder.includes(playerId) && !state.eliminatedPlayerIds.includes(playerId);
}

function nextActivePlayer(state: WordChainState, playerId: string): string | null {
  const active = activePlayerIds(state);
  if (active.length === 0) return null;
  const start = Math.max(0, state.playerOrder.indexOf(playerId));
  for (let offset = 1; offset <= state.playerOrder.length; offset += 1) {
    const candidate = state.playerOrder[(start + offset) % state.playerOrder.length];
    if (active.includes(candidate)) return candidate;
  }
  return active[0] ?? null;
}

function withRevision(state: WordChainState, patch: Partial<WordChainState>): WordChainState {
  return { ...state, ...patch, stateRevision: state.stateRevision + 1 };
}

function finish(state: WordChainState, winnerId: string | null): WordChainState {
  return withRevision(state, { phase: "FINISHED", currentPlayerId: null, winnerId, turnDeadline: null, remainingTurnMs: null, pendingChallenge: null });
}

function eliminateCurrent(state: WordChainState, now: number): WordChainState {
  const currentPlayerId = state.currentPlayerId;
  if (!currentPlayerId || !isActive(state, currentPlayerId)) return state;
  const eliminated = [...state.eliminatedPlayerIds, currentPlayerId];
  const next = { ...state, eliminatedPlayerIds: eliminated };
  const active = activePlayerIds(next);
  if (active.length <= 1) return finish(next, active[0] ?? null);
  return withRevision(next, {
    phase: "TURN",
    currentPlayerId: nextActivePlayer(next, currentPlayerId),
    turnDeadline: now + WORD_CHAIN_TURN_MS,
    remainingTurnMs: null,
    pendingChallenge: null,
    challengeUsedThisTurn: false,
    turnNumber: state.turnNumber + 1,
  });
}

function eligibleVoters(state: WordChainState): string[] {
  const proposerId = state.pendingChallenge?.proposerId;
  return activePlayerIds(state).filter((playerId) => playerId !== proposerId);
}

function quorum(voterCount: number): number {
  return Math.floor(voterCount / 2) + 1;
}

function resolveChallenge(state: WordChainState, now: number): WordChainState {
  const challenge = state.pendingChallenge;
  if (!challenge) return state;
  if (!isActive(state, challenge.proposerId)) return eliminateCurrent(state, now);
  const voters = eligibleVoters(state);
  const validVotes = voters.filter((playerId) => challenge.votes[playerId] === "VALID").length;
  const accepted = validVotes >= quorum(voters.length);
  if (accepted) return commitWord(state, challenge.word, challenge.proposerId, now, true);
  return withRevision(state, {
    phase: "TURN",
    pendingChallenge: null,
    turnDeadline: now + Math.max(challenge.remainingTurnMs, WORD_CHAIN_MIN_RETRY_MS),
    remainingTurnMs: null,
    challengeUsedThisTurn: true,
  });
}

function shouldResolveChallenge(state: WordChainState): boolean {
  const challenge = state.pendingChallenge;
  if (!challenge) return false;
  const voters = eligibleVoters(state);
  const validVotes = voters.filter((playerId) => challenge.votes[playerId] === "VALID").length;
  const castVotes = voters.filter((playerId) => challenge.votes[playerId] !== undefined).length;
  const needed = quorum(voters.length);
  return validVotes >= needed || validVotes + (voters.length - castVotes) < needed || castVotes === voters.length;
}

function commitWord(state: WordChainState, word: string, playerId: string, now: number, acceptedViaChallenge: boolean): WordChainState {
  const syllables = normalizeWord(word).split(" ");
  const nextPlayerId = nextActivePlayer(state, playerId);
  const historyEntry: WordChainHistoryEntry = { word, playerId, acceptedViaChallenge };
  const next = {
    ...state,
    phase: nextPlayerId ? "TURN" as const : "FINISHED" as const,
    currentPlayerId: nextPlayerId,
    currentWord: word,
    requiredSyllable: syllables[1] ?? null,
    usedWords: [...state.usedWords, word],
    wordHistory: [...state.wordHistory, historyEntry],
    turnDeadline: nextPlayerId ? now + WORD_CHAIN_TURN_MS : null,
    remainingTurnMs: null,
    pendingChallenge: null,
    winnerId: nextPlayerId ? null : playerId,
    turnNumber: state.turnNumber + 1,
    challengeUsedThisTurn: false,
    acceptedChallengeWords: acceptedViaChallenge ? [...state.acceptedChallengeWords, word] : state.acceptedChallengeWords,
  };
  return withRevision(next, {});
}

function validationError(result: Exclude<WordValidationResult, { code: "VALID" }>): AppError {
  return new AppError(result.code, result.message);
}

function readWord(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("word" in payload)) return "";
  const word = (payload as { word?: unknown }).word;
  return typeof word === "string" ? word : "";
}

function readVote(payload: unknown): WordChainVote | null {
  if (!payload || typeof payload !== "object" || !("vote" in payload)) return null;
  const vote = (payload as { vote?: unknown }).vote;
  return vote === "VALID" || vote === "INVALID" ? vote : null;
}

function validateForState(state: WordChainState, word: string): WordValidationResult {
  return validateWord(word, {
    requiredSyllable: state.requiredSyllable,
    usedWords: new Set(state.usedWords),
    acceptedChallengeWords: new Set(state.acceptedChallengeWords),
  });
}

function advanceState(state: WordChainState, now: number): WordChainState {
  if (state.phase === "TURN" && state.turnDeadline !== null && now >= state.turnDeadline) return eliminateCurrent(state, now);
  if (state.phase === "VOTING" && state.pendingChallenge && now >= state.pendingChallenge.votingDeadline) return resolveChallenge(state, now);
  return state;
}

export const wordChainEngine: GameEngine<WordChainState> = {
  id: "word-chain",
  minPlayers: 2,
  maxPlayers: 10,

  createInitialState(playerIds, now = Date.now()) {
    if (playerIds.length < 2 || playerIds.length > 10 || new Set(playerIds).size !== playerIds.length) throw new Error("Nối từ cần từ 2 đến 10 người chơi.");
    return {
      phase: "TURN",
      playerOrder: [...playerIds],
      currentPlayerId: playerIds[0],
      currentWord: null,
      requiredSyllable: null,
      usedWords: [],
      wordHistory: [],
      eliminatedPlayerIds: [],
      turnDeadline: now + WORD_CHAIN_TURN_MS,
      remainingTurnMs: null,
      pendingChallenge: null,
      winnerId: null,
      stateRevision: 1,
      turnNumber: 1,
      challengeUsedThisTurn: false,
      acceptedChallengeWords: [],
    };
  },

  applyAction(rawState, action: GameAction, playerId, now = Date.now()) {
    const state = advanceState(rawState, now);
    if (action.type === "tick") return state;
    if (state.phase === "FINISHED") throw new AppError("GAME_FINISHED", "Ván chơi đã kết thúc.");
    if (!isActive(state, playerId)) throw new AppError("PLAYER_ELIMINATED", "Bạn đã bị loại khỏi ván.");

    if (action.type === "submit-word") {
      if (state.phase !== "TURN") throw new AppError("GAME_NOT_TURN", "Chưa thể nhập từ lúc này.");
      if (state.currentPlayerId !== playerId) throw new AppError("NOT_YOUR_TURN", "Chưa đến lượt của bạn.");
      const result = validateForState(state, readWord(action.payload));
      if (result.code !== "VALID") throw validationError(result);
      return commitWord(state, result.word, playerId, now, false);
    }

    if (action.type === "challenge") {
      if (state.phase !== "TURN") throw new AppError("GAME_NOT_TURN", "Chưa thể thách thức lúc này.");
      if (state.currentPlayerId !== playerId) throw new AppError("NOT_YOUR_TURN", "Chưa đến lượt của bạn.");
      if (state.challengeUsedThisTurn) throw new AppError("CHALLENGE_ALREADY_USED", "Lượt này đã dùng quyền thách thức.");
      const result = validateForState(state, readWord(action.payload));
      if (result.code !== "NOT_IN_DICTIONARY") throw new AppError("CHALLENGE_NOT_ALLOWED", "Chỉ có thể thách thức từ không có trong từ điển.");
      const voters = activePlayerIds(state).filter((candidate) => candidate !== playerId);
      if (voters.length === 0) throw new AppError("NO_VOTERS", "Không có người chơi nào có thể bỏ phiếu.");
      return withRevision(state, {
        phase: "VOTING",
        turnDeadline: null,
        remainingTurnMs: Math.max(0, (state.turnDeadline ?? now) - now),
        pendingChallenge: { word: result.word, proposerId: playerId, turnNumber: state.turnNumber, remainingTurnMs: Math.max(0, (state.turnDeadline ?? now) - now), votingDeadline: now + WORD_CHAIN_VOTING_MS, votes: {} },
      });
    }

    if (action.type === "vote") {
      if (state.phase !== "VOTING" || !state.pendingChallenge) throw new AppError("VOTING_NOT_ACTIVE", "Không có lượt biểu quyết.");
      if (state.pendingChallenge.proposerId === playerId) throw new AppError("PROPOSER_CANNOT_VOTE", "Người đề xuất không được bỏ phiếu.");
      if (!eligibleVoters(state).includes(playerId)) throw new AppError("UNAUTHORIZED_VOTE", "Bạn không có quyền bỏ phiếu.");
      if (state.pendingChallenge.votes[playerId]) throw new AppError("DUPLICATE_VOTE", "Bạn đã bỏ phiếu rồi.");
      const vote = readVote(action.payload);
      if (!vote) throw new AppError("INVALID_VOTE", "Phiếu không hợp lệ.");
      const next = withRevision(state, { pendingChallenge: { ...state.pendingChallenge, votes: { ...state.pendingChallenge.votes, [playerId]: vote } } });
      return shouldResolveChallenge(next) ? resolveChallenge(next, now) : next;
    }

    throw new AppError("UNSUPPORTED_ACTION", "Hành động không được hỗ trợ.");
  },

  advance: advanceState,

  onPlayerLeave(rawState, playerId, now) {
    if (!rawState.playerOrder.includes(playerId) || rawState.eliminatedPlayerIds.includes(playerId)) return rawState;
    const state = withRevision(rawState, { eliminatedPlayerIds: [...rawState.eliminatedPlayerIds, playerId] });
    const active = activePlayerIds(state);
    if (active.length <= 1) return finish(state, active[0] ?? null);
    if (state.phase === "VOTING" && state.pendingChallenge?.proposerId === playerId) {
      return withRevision(state, { phase: "TURN", currentPlayerId: nextActivePlayer(state, playerId), pendingChallenge: null, turnDeadline: now + WORD_CHAIN_TURN_MS, remainingTurnMs: null, challengeUsedThisTurn: false, turnNumber: state.turnNumber + 1 });
    }
    if (state.phase === "VOTING" && shouldResolveChallenge(state)) return resolveChallenge(state, now);
    if (state.currentPlayerId === playerId) return withRevision(state, { phase: "TURN", currentPlayerId: nextActivePlayer(state, playerId), pendingChallenge: null, turnDeadline: now + WORD_CHAIN_TURN_MS, remainingTurnMs: null, challengeUsedThisTurn: false, turnNumber: state.turnNumber + 1 });
    return state;
  },

  getResult(state) {
    return { finished: state.phase === "FINISHED", winnerId: state.winnerId, isDraw: false };
  },

  reset(playerIds) {
    return this.createInitialState(playerIds, Date.now());
  },

  toPublicState(state) {
    return state;
  },
};
