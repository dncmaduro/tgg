"use client";

import type { RuntimePlayer } from "../engine/simulation";

export function Scoreboard({ players, localPlayerId }: { players: RuntimePlayer[]; localPlayerId: string }) {
  const sorted = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  return <div className="pointer-events-auto w-[min(92vw,520px)] rounded-2xl border border-white/15 bg-[#171b1f]/95 p-4 shadow-2xl backdrop-blur-sm">
    <div className="mb-3 flex items-baseline justify-between"><h2 className="text-sm font-semibold text-white">Bảng điểm</h2><span className="text-[11px] text-slate-500">TAB để đóng</span></div>
    <div className="grid grid-cols-[minmax(0,1fr)_70px_70px] gap-3 border-b border-white/10 px-2 pb-2 text-[10px] uppercase tracking-[.16em] text-slate-500"><span>Người chơi</span><span className="text-right">Hạ</span><span className="text-right">Ngã</span></div>
    <div className="divide-y divide-white/5">{sorted.map((player) => <div key={player.id} className={`grid grid-cols-[minmax(0,1fr)_70px_70px] gap-3 px-2 py-2.5 text-sm ${player.id === localPlayerId ? "text-mint" : "text-slate-200"}`}><span className="truncate">{player.nickname}{player.id === localPlayerId ? " · bạn" : ""}</span><span className="text-right font-mono">{player.kills}</span><span className="text-right font-mono text-slate-400">{player.deaths}</span></div>)}</div>
  </div>;
}
