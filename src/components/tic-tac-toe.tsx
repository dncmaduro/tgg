"use client";

import { LogOut, RotateCcw } from "lucide-react";
import type { RoomSnapshot, TicTacToeState } from "@/types/domain";

type TicTacToeGameProps = {
  room: RoomSnapshot;
  playerId: string;
  isHost: boolean;
  onAction: (position: number) => void;
  onRestart: () => void;
  onLeave: () => void;
  disabled: boolean;
};

export function TicTacToeGame({ room, playerId, isHost, onAction, onRestart, onLeave, disabled }: TicTacToeGameProps) {
  const state = room.gameState as TicTacToeState | null;
  if (!state) return null;

  const symbol = state.players[playerId];
  const winnerName = state.winnerId ? room.players.find((player) => player.id === state.winnerId)?.nickname : undefined;
  const currentName = room.players.find((player) => player.id === state.currentPlayerId)?.nickname;
  const finished = Boolean(state.winnerId) || state.isDraw;

  return <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
    <div className="rounded-2xl border border-line bg-panel p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-slate-400">Caro mini</p><h2 className="mt-1 text-2xl font-semibold text-white">{symbol ? `Bạn là ${symbol}` : "Người xem"}</h2></div><span className="text-sm text-slate-500">{finished ? "Đã kết thúc" : "Đang chơi"}</span></div>
      <div className="mx-auto mt-8 grid max-w-[390px] grid-cols-3 gap-2 rounded-xl border border-line bg-ink p-2 sm:gap-3 sm:p-3">
        {state.board.map((cell, index) => {
          const highlighted = state.winningLine.includes(index);
          const canPlay = !disabled && !finished && !cell && state.currentPlayerId === playerId;
          return <button key={index} type="button" aria-label={`Ô ${index + 1}`} onClick={() => onAction(index)} disabled={!canPlay} className={`aspect-square rounded-lg border text-4xl font-semibold transition sm:text-5xl ${highlighted ? "border-mint bg-mint text-ink" : cell ? "border-line bg-panel text-white" : "border-line bg-white/[.02] text-white hover:border-mint hover:bg-white/[.04] disabled:hover:border-line disabled:hover:bg-white/[.02]"}`}>{cell}</button>;
        })}
      </div>
      <p className="mx-auto mt-5 max-w-[390px] text-center text-sm text-slate-400" role="status">{finished ? (state.isDraw ? "Hòa." : `${winnerName ?? "Người chơi"} thắng.`) : state.currentPlayerId === playerId ? "Đến lượt bạn." : `Lượt của ${currentName ?? "đối thủ"}.`}</p>
    </div>

    <aside className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-sm font-medium text-slate-400">Người chơi</p>
      <div className="mt-3 space-y-1">
        {room.players.map((player) => <div key={player.id} className={`flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0 ${player.id === playerId ? "text-white" : "text-slate-400"}`}><span className="truncate text-sm">{player.nickname}{player.id === playerId ? " (bạn)" : ""}</span><span className="font-mono text-sm text-slate-500">{state.players[player.id]}</span></div>)}
      </div>
      {finished && (isHost ? <button type="button" onClick={onRestart} disabled={disabled} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mint px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw size={16} /> Chơi lại</button> : <p className="mt-5 text-center text-xs text-slate-500">Chờ chủ phòng bắt đầu ván mới.</p>)}
      <button type="button" onClick={onLeave} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"><LogOut size={16} /> Rời phòng</button>
    </aside>
  </section>;
}
