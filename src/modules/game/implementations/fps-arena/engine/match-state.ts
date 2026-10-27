import type { FpsArenaScore, FpsArenaState } from "@/types/domain";
import type { AnyGameEngine, GameAction, GameResult } from "@/modules/game/core/types";
import { FPS_RULES } from "./rules";

function emptyScore(): FpsArenaScore {
  return { kills: 0, deaths: 0 };
}

function scoreRecord(playerIds: string[]): Record<string, FpsArenaScore> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, emptyScore()]));
}

function winners(scores: Record<string, FpsArenaScore>): string[] {
  const entries = Object.entries(scores);
  if (entries.length === 0) return [];
  const top = Math.max(...entries.map(([, score]) => score.kills));
  return entries.filter(([, score]) => score.kills === top).map(([playerId]) => playerId);
}

export const fpsArenaEngine: AnyGameEngine = {
  id: "fps-arena",
  minPlayers: 2,
  maxPlayers: 6,
  createInitialState(playerIds, now = Date.now()): FpsArenaState {
    void now;
    return {
      phase: "CONNECTING",
      playerIds: [...playerIds],
      scores: scoreRecord(playerIds),
      countdownEndsAt: null,
      startedAt: null,
      endsAt: null,
      winnerIds: [],
      finishReason: null,
      stateRevision: 1,
    };
  },
  applyAction(state, action: GameAction, _playerId, now = Date.now()): FpsArenaState {
    if (action.type === "fps-begin-match") {
      if (state.phase !== "CONNECTING") return state;
      const countdownEndsAt = now + FPS_RULES.countdownMs;
      return {
        ...state,
        phase: "COUNTDOWN",
        countdownEndsAt,
        startedAt: countdownEndsAt,
        endsAt: countdownEndsAt + FPS_RULES.matchDurationMs,
        stateRevision: state.stateRevision + 1,
      };
    }

    if (action.type === "fps-finish-match") {
      const payload = action.payload && typeof action.payload === "object" ? action.payload as { scores?: unknown; reason?: unknown } : {};
      const inputScores = payload.scores && typeof payload.scores === "object" ? payload.scores as Record<string, unknown> : {};
      const scores = scoreRecord(state.playerIds);
      for (const playerId of state.playerIds) {
        const candidate = inputScores[playerId];
        if (!candidate || typeof candidate !== "object") continue;
        const value = candidate as { kills?: unknown; deaths?: unknown };
        scores[playerId] = {
          kills: Math.max(0, Math.min(10_000, Math.floor(typeof value.kills === "number" ? value.kills : 0))),
          deaths: Math.max(0, Math.min(10_000, Math.floor(typeof value.deaths === "number" ? value.deaths : 0))),
        };
      }
      return {
        ...state,
        phase: "FINISHED",
        scores,
        winnerIds: winners(scores),
        finishReason: payload.reason === "score" ? "score" : "time",
        stateRevision: state.stateRevision + 1,
      };
    }

    throw new Error("Hành động FPS không hợp lệ.");
  },
  getResult(state): GameResult {
    return {
      finished: state.phase === "FINISHED",
      winnerId: state.winnerIds.length === 1 ? state.winnerIds[0] : null,
      isDraw: state.phase === "FINISHED" && state.winnerIds.length !== 1,
    };
  },
  reset(playerIds): FpsArenaState {
    return this.createInitialState(playerIds);
  },
  toPublicState(state): FpsArenaState {
    return state;
  },
  advance(state, now): FpsArenaState {
    if (state.phase === "COUNTDOWN" && state.countdownEndsAt !== null && now >= state.countdownEndsAt) {
      return { ...state, phase: "PLAYING", stateRevision: state.stateRevision + 1 };
    }
    if (state.phase === "PLAYING" && state.endsAt !== null && now >= state.endsAt) {
      return { ...state, phase: "FINISHED", winnerIds: winners(state.scores), finishReason: "time", stateRevision: state.stateRevision + 1 };
    }
    return state;
  },
};

