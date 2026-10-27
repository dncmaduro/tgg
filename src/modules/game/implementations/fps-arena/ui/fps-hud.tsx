"use client";

import type { RuntimePlayer } from "../engine/simulation";
import { Scoreboard } from "./scoreboard";

type Props = {
  localPlayer: RuntimePlayer | undefined;
  players: RuntimePlayer[];
  localPlayerId: string;
  remainingMs: number | null;
  locked: boolean;
  scoreboardOpen: boolean;
  networkStatus: string;
  countdown: number | null;
  hitMarker: boolean;
  hostDisconnected: boolean;
  hostPaused: boolean;
  networkFailure: boolean;
  mobile: boolean;
  onContinue: () => void;
  onLeave: () => void;
  now: number;
  killerName: string | null;
};

export function FpsHud({ localPlayer, players, localPlayerId, remainingMs, locked, scoreboardOpen, networkStatus, countdown, hitMarker, hostDisconnected, hostPaused, networkFailure, mobile, onContinue, onLeave, now, killerName }: Props) {
  const seconds = remainingMs === null ? "—" : `${Math.floor(Math.max(0, remainingMs) / 60_000).toString().padStart(2, "0")}:${Math.floor((Math.max(0, remainingMs) % 60_000) / 1_000).toString().padStart(2, "0")}`;
  const respawnSeconds = localPlayer?.respawnAt ? Math.max(0, Math.ceil((localPlayer.respawnAt - now) / 1_000)) : 0;
  return <div className="pointer-events-none absolute inset-0 z-10 text-white">
    {mobile && <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#0f1115] p-8 text-center"><div><p className="text-lg font-semibold">FPS Arena cần máy tính</p><p className="mt-2 text-sm text-slate-500">Phiên bản đầu tiên hỗ trợ bàn phím, chuột trên desktop.</p></div></div>}
    {!mobile && <>
      <div className="absolute left-5 top-5 flex items-center gap-4 text-xs sm:left-8 sm:top-7"><span className="font-mono text-sm font-semibold tracking-wide">{seconds}</span><span className="text-slate-400">Hạ <b className="ml-1 font-mono text-white">{localPlayer?.kills ?? 0}</b></span><span className="border-l border-white/15 pl-4 text-slate-500">{networkStatus}</span></div>
      {networkFailure && !hostDisconnected && <div className="pointer-events-auto absolute left-1/2 top-16 -translate-x-1/2 rounded-lg border border-red-300/25 bg-[#171b1f]/90 px-4 py-2 text-center text-xs text-red-200">Không thể kết nối trực tiếp với người chơi khác.</div>}
      <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2"><span className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-white/80" /><span className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-white/80" /><span className="absolute left-0 top-1/2 h-px w-2 -translate-y-1/2 bg-white/80" /><span className="absolute right-0 top-1/2 h-px w-2 -translate-y-1/2 bg-white/80" />{hitMarker && <span className="absolute inset-0 text-center text-lg font-semibold leading-5 text-white">×</span>}</div>
      <div className="absolute bottom-5 left-5 flex items-end gap-4 sm:bottom-7 sm:left-8"><div><p className="mb-1 text-[10px] uppercase tracking-[.18em] text-slate-500">Sức khỏe</p><div className="h-2 w-40 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-mint transition-[width]" style={{ width: `${localPlayer?.hp ?? 0}%` }} /></div><p className="mt-1 font-mono text-xs text-slate-300">{localPlayer?.hp ?? 0} / 100</p></div><div className="border-l border-white/15 pl-4"><p className="text-xs font-semibold text-white">ASSAULT RIFLE</p><p className="mt-1 text-[10px] text-slate-500">∞ đạn · 25 sát thương</p></div></div>
      {!locked && !hostDisconnected && countdown === null && <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#0f1115]/55"><div className="text-center"><p className="text-sm text-slate-300">Nhấn để khóa chuột và vào trận</p><div className="mt-4 flex justify-center gap-2"><button type="button" onClick={onContinue} className="rounded-xl bg-mint px-5 py-3 text-sm font-semibold text-ink hover:bg-white">Tiếp tục</button><button type="button" onClick={onLeave} className="rounded-xl border border-line bg-panel px-5 py-3 text-sm font-semibold text-white hover:bg-white/5">Rời trận</button></div><p className="mt-3 text-xs text-slate-500">WASD di chuyển · Shift chạy · Space nhảy · Esc tạm dừng · Tab bảng điểm</p></div></div>}
      {countdown !== null && <div className="absolute inset-0 flex items-center justify-center bg-[#0f1115]/35"><span className="font-mono text-7xl font-semibold text-white">{countdown}</span></div>}
      {localPlayer && !localPlayer.alive && <div className="absolute inset-0 flex items-center justify-center bg-[#0f1115]/40"><div className="text-center"><p className="text-2xl font-semibold text-white">Bạn đã bị hạ</p><p className="mt-2 text-sm text-slate-400">Bởi {killerName ?? "đối thủ"} · hồi sinh sau {respawnSeconds}s</p></div></div>}
      {hostDisconnected && <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#0f1115]/90 p-5"><div className="max-w-sm text-center"><p className="text-xl font-semibold text-white">Chủ phòng đã rời trận</p><p className="mt-2 text-sm text-slate-500">Simulation không còn authority. Ván đấu đã dừng.</p><button type="button" onClick={onLeave} className="mt-5 rounded-xl bg-mint px-5 py-3 text-sm font-semibold text-ink">Về phòng chờ</button></div></div>}
      {hostPaused && !hostDisconnected && <div className="absolute inset-0 flex items-center justify-center bg-[#0f1115]/65"><div className="text-center"><p className="text-xl font-semibold text-white">Ván đấu tạm dừng</p><p className="mt-2 text-sm text-slate-500">Tab của chủ phòng đang bị ẩn. Trận sẽ tiếp tục khi chủ phòng quay lại.</p></div></div>}
      {scoreboardOpen && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Scoreboard players={players} localPlayerId={localPlayerId} /></div>}
    </>}
  </div>;
}
