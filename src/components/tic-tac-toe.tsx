"use client";

import { RotateCcw, Trophy } from "lucide-react";
import type { RoomSnapshot, TicTacToeState } from "@/types/domain";

export function TicTacToeGame({ room, playerId, onAction, onRestart, disabled }: { room: RoomSnapshot; playerId: string; onAction: (position: number) => void; onRestart: () => void; disabled: boolean }) {
  const state = room.gameState as TicTacToeState | null;
  if (!state) return null;
  const symbol = state.players[playerId];
  const winnerName = state.winnerId ? room.players.find((player) => player.id === state.winnerId)?.nickname : undefined;
  const currentName = room.players.find((player) => player.id === state.currentPlayerId)?.nickname;
  const finished = Boolean(state.winnerId) || state.isDraw;

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-5 sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-mint">ván đang diễn ra</p><h2 className="mt-2 text-2xl font-black tracking-tight text-white">Caro mini <span className="text-slate-600">/</span> {symbol ? `Bạn là ${symbol}` : "người xem"}</h2></div><div className={`rounded-full px-3 py-1.5 text-xs font-bold ${finished ? "bg-lavender/10 text-lavender" : "bg-mint/10 text-mint"}`}>{finished ? "đã kết thúc" : "lượt chơi"}</div></div>
        <div className="mx-auto mt-10 grid max-w-[390px] grid-cols-3 gap-2.5 rounded-3xl border border-white/10 bg-[#0c1017] p-3 shadow-2xl sm:gap-3 sm:p-4">
          {state.board.map((cell, index) => {
            const highlighted = state.winningLine.includes(index);
            return <button key={index} aria-label={`Ô ${index + 1}`} onClick={() => onAction(index)} disabled={disabled || finished || Boolean(cell) || state.currentPlayerId !== playerId} className={`aspect-square rounded-2xl border text-4xl font-black transition sm:text-5xl ${highlighted ? "border-mint/70 bg-mint/15 text-mint shadow-[0_0_28px_rgba(159,243,199,.18)]" : cell === "X" ? "border-coral/20 bg-coral/[.06] text-coral" : cell === "O" ? "border-lavender/20 bg-lavender/[.06] text-lavender" : "border-white/5 bg-white/[.035] text-white hover:border-mint/40 hover:bg-mint/[.08] disabled:hover:border-white/5 disabled:hover:bg-white/[.035]"}`}>{cell}</button>;
          })}
        </div>
        <div className="mx-auto mt-6 max-w-[390px] rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-center text-sm text-slate-400">{finished ? (state.isDraw ? "Hòa rồi — làm ván khác nhé." : `${winnerName ?? "Một người chơi"} thắng ván này.`) : state.currentPlayerId === playerId ? "Đến lượt bạn — chọn một ô trống." : `Đang chờ ${currentName ?? "đối thủ"} đi…`}</div>
      </div>
      <aside className="space-y-4"><div className="rounded-3xl border border-white/10 bg-white/[.04] p-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">bảng điểm</p><div className="mt-4 space-y-2">{room.players.map((player) => <div key={player.id} className={`flex items-center justify-between rounded-2xl border px-3 py-3 ${player.id === playerId ? "border-mint/30 bg-mint/[.06]" : "border-white/10 bg-white/[.025]"}`}><span className="truncate text-sm font-semibold text-white">{player.nickname}</span><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${state.players[player.id] === "X" ? "bg-coral/10 text-coral" : "bg-lavender/10 text-lavender"}`}>{state.players[player.id]}</span></div>)}</div></div>
        {finished && <button onClick={onRestart} disabled={disabled} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-mint px-4 py-3.5 text-sm font-black text-ink transition hover:bg-white disabled:opacity-50"><RotateCcw size={17} /> chơi lại</button>}
        {!finished && <div className="rounded-3xl border border-white/10 bg-white/[.025] p-5 text-sm leading-6 text-slate-500"><Trophy size={17} className="mb-3 text-lavender" /> Luật đơn giản: X đi trước, đánh đủ 3 ô liên tiếp để thắng.</div>}
      </aside>
    </section>
  );
}
