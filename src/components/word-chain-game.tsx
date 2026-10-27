"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, RotateCcw, Send } from "lucide-react";
import type { GameAction } from "@/modules/game/core/types";
import { RoomMutationError } from "@/hooks/use-room";
import type { RoomSnapshot, WordChainState, WordChainVote } from "@/types/domain";

const EMPTY_STATE: WordChainState = {
  phase: "TURN",
  playerOrder: [],
  currentPlayerId: null,
  currentWord: null,
  requiredSyllable: null,
  usedWords: [],
  wordHistory: [],
  eliminatedPlayerIds: [],
  turnDeadline: null,
  remainingTurnMs: null,
  pendingChallenge: null,
  winnerId: null,
  stateRevision: 0,
  turnNumber: 0,
  challengeUsedThisTurn: false,
  acceptedChallengeWords: [],
};

type WordChainGameProps = {
  room: RoomSnapshot;
  playerId: string;
  isHost: boolean;
  disabled: boolean;
  onAction: (action: GameAction) => Promise<unknown>;
  onRestart: () => void;
  onLeave: () => void;
};

export function WordChainGame({ room, playerId, isHost, disabled, onAction, onRestart, onLeave }: WordChainGameProps) {
  const state = (room.gameState as WordChainState | null) ?? EMPTY_STATE;
  const hasState = Boolean(room.gameState);
  const [now, setNow] = useState(() => Date.now());
  const [input, setInput] = useState("");
  const [challengeWord, setChallengeWord] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tickKeyRef = useRef<string | null>(null);

  const isMyTurn = state.phase === "TURN" && state.currentPlayerId === playerId;
  const currentPlayer = room.players.find((player) => player.id === state.currentPlayerId);
  const deadline = state.phase === "VOTING" ? state.pendingChallenge?.votingDeadline ?? null : state.turnDeadline;
  const remainingSeconds = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1_000));
  const activePlayers = room.players.filter((player) => !state.eliminatedPlayerIds.includes(player.id));
  const pendingVote = state.pendingChallenge?.votes[playerId];
  const canVote = state.phase === "VOTING" && Boolean(state.pendingChallenge) && state.pendingChallenge?.proposerId !== playerId && activePlayers.some((player) => player.id === playerId);
  const validVoteCount = state.pendingChallenge ? Object.entries(state.pendingChallenge.votes).filter(([voterId, vote]) => activePlayers.some((player) => player.id === voterId) && vote === "VALID").length : 0;
  const eligibleVoteCount = state.pendingChallenge ? activePlayers.filter((player) => player.id !== state.pendingChallenge?.proposerId).length : 0;
  const winner = state.winnerId ? room.players.find((player) => player.id === state.winnerId) : undefined;

  useEffect(() => {
    if (deadline === null) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [deadline]);

  useEffect(() => {
    if (!deadline || disabled) return undefined;
    const key = `${state.stateRevision}:${deadline}`;
    const delay = Math.max(0, deadline - Date.now()) + 75;
    const timeout = window.setTimeout(() => {
      if (tickKeyRef.current === key) return;
      tickKeyRef.current = key;
      void onAction({ type: "tick", payload: null }).catch(() => undefined);
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [deadline, disabled, onAction, state.stateRevision]);

  useEffect(() => {
    if (isMyTurn && !challengeWord && !disabled) inputRef.current?.focus();
  }, [challengeWord, disabled, isMyTurn]);

  const wordPlayers = useMemo(() => new Map(room.players.map((player) => [player.id, player.nickname])), [room.players]);

  if (!hasState) return null;

  const send = async (action: GameAction, afterSuccess: () => void) => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await onAction(action);
      afterSuccess();
      setError(null);
    } catch (cause) {
      if (cause instanceof RoomMutationError && cause.code === "NOT_IN_DICTIONARY") {
        setChallengeWord(input.trim());
        setError("Không có trong từ điển.");
      } else {
        setError(cause instanceof Error ? cause.message : "Không thể cập nhật ván chơi.");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitWord = (event?: React.FormEvent) => {
    event?.preventDefault();
    const word = input.trim();
    if (!word || !isMyTurn) return;
    void send({ type: "submit-word", payload: { word } }, () => {
      setInput("");
      setChallengeWord(null);
    });
  };

  const challenge = () => {
    const word = challengeWord ?? input.trim();
    if (!word || !isMyTurn) return;
    void send({ type: "challenge", payload: { word } }, () => setChallengeWord(null));
  };

  const vote = (voteChoice: WordChainVote) => {
    if (!canVote || pendingVote) return;
    void send({ type: "vote", payload: { vote: voteChoice } }, () => undefined);
  };

  return <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="rounded-2xl border border-line bg-panel p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm text-slate-400">NỐI TỪ</p><h2 className="mt-1 text-2xl font-semibold text-white">{state.requiredSyllable ? `Nối với "${state.requiredSyllable.toUpperCase()}"` : "Bắt đầu bằng một từ bất kỳ"}</h2></div>
        <div className="text-right"><p className="text-xs text-slate-500">{state.phase === "VOTING" ? "Thời gian biểu quyết" : "Thời gian lượt"}</p><p className={`mt-1 font-mono text-2xl font-semibold ${remainingSeconds <= 5 ? "text-red-300" : "text-mint"}`}>{remainingSeconds}s</p></div>
      </div>
      <p className="mt-3 text-sm text-slate-400">{state.phase === "VOTING" ? `Đang biểu quyết từ "${state.pendingChallenge?.word}".` : currentPlayer ? `Lượt của ${currentPlayer.nickname}.` : "Đang chờ lượt chơi."}</p>

      {state.phase === "TURN" && isMyTurn && <form onSubmit={submitWord} className="mt-6 flex flex-col gap-2 sm:flex-row"><label htmlFor="word-chain-input" className="sr-only">Nhập từ ghép</label><input ref={inputRef} id="word-chain-input" value={input} onChange={(event) => { setInput(event.target.value); if (error) setError(null); }} disabled={disabled || busy} placeholder={state.requiredSyllable ? `Bắt đầu bằng ${state.requiredSyllable}` : "Ví dụ: học sinh"} autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-3.5 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-mint" /><button type="submit" disabled={disabled || busy || !input.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-mint px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"><Send size={16} /> Gửi</button></form>}
      {state.phase === "TURN" && !isMyTurn && <div className="mt-6 rounded-xl border border-line px-4 py-3 text-sm text-slate-400">Đang chờ {currentPlayer?.nickname ?? "người chơi"} nhập từ.</div>}
      {state.phase === "FINISHED" && <div className="mt-6 rounded-xl border border-mint/30 bg-mint/5 px-4 py-4 text-center text-lg font-semibold text-white">{winner?.nickname ?? "Người chơi"} chiến thắng</div>}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}

      {challengeWord && state.phase === "TURN" && isMyTurn && <div className="mt-4 rounded-xl border border-line p-4"><p className="text-sm text-slate-300">Không có trong từ điển.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setChallengeWord(null); setError(null); inputRef.current?.focus(); }} className="rounded-lg border border-line px-3 py-2 text-sm text-white transition hover:bg-white/5">Nhập từ khác</button><button type="button" onClick={challenge} disabled={busy || disabled} className="rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-ink transition hover:bg-white disabled:opacity-50">Thách thức</button></div></div>}

      {state.phase === "VOTING" && state.pendingChallenge && <div className="mt-5 rounded-xl border border-line p-4"><p className="text-sm text-slate-400">Từ này có hợp lệ không?</p><p className="mt-2 text-xl font-semibold text-white">{state.pendingChallenge.word}</p><p className="mt-2 text-xs text-slate-500">{validVoteCount}/{eligibleVoteCount} phiếu hợp lệ</p>{canVote && !pendingVote ? <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => vote("VALID")} disabled={busy || disabled} className="rounded-lg border border-mint/40 px-3 py-2.5 text-sm font-semibold text-mint transition hover:bg-mint/10">Hợp lệ</button><button type="button" onClick={() => vote("INVALID")} disabled={busy || disabled} className="rounded-lg border border-line px-3 py-2.5 text-sm text-white transition hover:bg-white/5">Không hợp lệ</button></div> : <p className="mt-4 text-sm text-slate-500">{pendingVote ? "Đã ghi nhận phiếu của bạn. Đang chờ kết quả." : "Người đề xuất không bỏ phiếu."}</p>}</div>}
    </div>

    <aside className="space-y-5">
      <div className="rounded-2xl border border-line bg-panel p-5"><p className="text-sm font-medium text-slate-400">Chuỗi từ</p><div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{state.wordHistory.length === 0 ? <p className="text-sm text-slate-500">Chưa có từ nào.</p> : state.wordHistory.map((entry, index) => <div key={`${entry.word}-${entry.playerId}-${index}`} className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0"><div><p className="font-medium text-white">{entry.word}</p><p className="text-xs text-slate-500">{wordPlayers.get(entry.playerId) ?? "Người chơi"}</p></div>{entry.acceptedViaChallenge && <span className="text-[11px] text-slate-500">thách thức</span>}</div>)}</div></div>
      <div className="rounded-2xl border border-line bg-panel p-5"><p className="text-sm font-medium text-slate-400">Người chơi</p><div className="mt-3 space-y-1">{room.players.map((player) => { const eliminated = state.eliminatedPlayerIds.includes(player.id); return <div key={player.id} className={`flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0 ${eliminated ? "text-slate-600" : "text-white"}`}><span className="truncate text-sm">{player.nickname}{player.id === playerId ? " (bạn)" : ""}</span><span className="text-xs">{eliminated ? "Đã bị loại" : player.id === state.currentPlayerId ? "Đang chơi" : "Còn trong trận"}</span></div>; })}</div></div>
      {state.phase === "FINISHED" && isHost && <button type="button" onClick={onRestart} disabled={disabled} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mint px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white disabled:opacity-50"><RotateCcw size={16} /> Chơi lại</button>}
      {state.phase === "FINISHED" && !isHost && <p className="text-center text-xs text-slate-500">Chờ chủ phòng bắt đầu ván mới.</p>}
      <button type="button" onClick={onLeave} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"><LogOut size={16} /> Rời phòng</button>
    </aside>
  </section>;
}
