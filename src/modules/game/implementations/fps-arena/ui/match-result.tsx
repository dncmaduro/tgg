"use client";

import type { FpsArenaState, RoomSnapshot } from "@/types/domain";

export function MatchResult({ room, state, onRestart, onLeave }: { room: RoomSnapshot; state: FpsArenaState; onRestart: () => void; onLeave: () => void }) {
  const players = [...room.players].sort((a, b) => (state.scores[b.id]?.kills ?? 0) - (state.scores[a.id]?.kills ?? 0) || (state.scores[a.id]?.deaths ?? 0) - (state.scores[b.id]?.deaths ?? 0));
  const winners = new Set(state.winnerIds);
  return <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#0f1115]/90 p-5">
    <section className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl sm:p-8">
      <p className="text-xs font-medium uppercase tracking-[.18em] text-slate-500">Training Arena · Kết quả</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{winners.size === 1 ? `Chiến thắng: ${room.players.find((player) => winners.has(player.id))?.nickname ?? "—"}` : "Hòa điểm"}</h1>
      <p className="mt-2 text-sm text-slate-500">{state.finishReason === "score" ? "Đạt 10 điểm trước." : "Hết 180 giây."}</p>
      <div className="mt-6 overflow-hidden rounded-xl border border-line"><div className="grid grid-cols-[minmax(0,1fr)_70px_70px] gap-3 bg-ink px-3 py-2 text-[10px] uppercase tracking-[.16em] text-slate-500"><span>Người chơi</span><span className="text-right">Hạ</span><span className="text-right">Ngã</span></div>{players.map((player) => <div key={player.id} className={`grid grid-cols-[minmax(0,1fr)_70px_70px] gap-3 border-t border-line px-3 py-3 text-sm ${winners.has(player.id) ? "text-mint" : "text-slate-200"}`}><span className="truncate">{player.nickname}</span><span className="text-right font-mono">{state.scores[player.id]?.kills ?? 0}</span><span className="text-right font-mono text-slate-400">{state.scores[player.id]?.deaths ?? 0}</span></div>)}</div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" onClick={onRestart} className="rounded-xl bg-mint px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white">Chơi lại</button><button type="button" onClick={onLeave} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5">Rời phòng</button></div>
    </section>
  </div>;
}
