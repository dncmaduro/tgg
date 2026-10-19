"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clipboard, Copy, Crown, LogOut, Radio, RefreshCw, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getClientIdentity, updateNickname, type ClientIdentity } from "@/modules/identity/client";
import { useRoom } from "@/hooks/use-room";
import { TicTacToeGame } from "@/components/tic-tac-toe";
import type { RoomSnapshot } from "@/types/domain";

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [identity, setIdentity] = useState<ClientIdentity>({ playerId: "", credential: "", nickname: "" });
  const [nameDraft, setNameDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const { room, setRoom, connection, loading, error, setError, mutate } = useRoom(code, identity);

  useEffect(() => {
    const current = getClientIdentity();
    queueMicrotask(() => {
      setIdentity(current);
      setNameDraft(current.nickname);
    });
  }, []);

  const me = useMemo(() => room?.players.find((player) => player.id === identity.playerId), [room, identity.playerId]);
  const isHost = Boolean(me?.isHost && room?.hostId === identity.playerId);

  const run = async (intent: "ready" | "start" | "action" | "restart" | "leave", extras: Record<string, unknown> = {}) => {
    try { await mutate(intent, extras); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật phòng."); }
  };

  const join = async () => {
    if (nameDraft.trim().length < 2) return setError("Nickname cần ít nhất 2 ký tự.");
    setJoining(true);
    const nextIdentity = updateNickname(nameDraft.trim());
    setIdentity(nextIdentity);
    try {
      const response = await fetch(`/api/rooms/${code}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intent: "join", identity: nextIdentity }) });
      const body = await response.json() as { room?: RoomSnapshot; error?: { message?: string } };
      if (!response.ok || !body.room) throw new Error(body.error?.message ?? "Không thể tham gia phòng.");
      setRoom(body.room);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tham gia phòng."); }
    finally { setJoining(false); }
  };

  const copy = async (text: string, message: string) => {
    try { await navigator.clipboard.writeText(text); setToast(message); window.setTimeout(() => setToast(null), 2_000); }
    catch { setError("Không thể copy trên trình duyệt này."); }
  };

  const leave = async () => {
    await run("leave");
    router.push("/");
  };

  if (loading && !room) return <div className="flex min-h-screen items-center justify-center px-5"><div className="flex items-center gap-3 text-sm text-slate-400"><RefreshCw size={17} className="animate-spin text-mint" /> đang mở phòng…</div></div>;

  return <main className="min-h-screen px-5 py-6 sm:px-8"><header className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/" className="flex items-center gap-2 text-sm font-black text-white"><span className="text-mint">✦</span> MiniPlay</Link><button onClick={() => router.push("/")} className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-white"><ArrowLeft size={16} /> trang chủ</button></header>
    <div className="mx-auto max-w-6xl pb-20 pt-12">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-mint"><span className="h-2 w-2 rounded-full bg-mint" /> phòng {code}</div><h1 className="mt-3 text-4xl font-black tracking-[-.05em] text-white sm:text-5xl">{room?.gameTitle ?? "Phòng chơi"}</h1><p className="mt-2 text-sm text-slate-500">{room?.gameDescription ?? "Tham gia phòng để bắt đầu."}</p></div><div className={`flex items-center gap-2 self-start rounded-full border px-3 py-2 text-xs font-bold ${connection === "online" ? "border-mint/20 bg-mint/10 text-mint" : connection === "connecting" ? "border-lavender/20 bg-lavender/10 text-lavender" : "border-coral/20 bg-coral/10 text-coral"}`}>{connection === "online" ? <Radio size={14} /> : connection === "connecting" ? <RefreshCw size={14} className="animate-spin" /> : <WifiOff size={14} />}{connection === "online" ? "realtime đang bật" : connection === "connecting" ? "đang kết nối…" : "mất kết nối · đang thử lại"}</div></div>

      {(!room || !me) && <section className="mx-auto max-w-lg rounded-[2rem] border border-white/10 bg-white/[.04] p-6 shadow-glow sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-mint">bạn được mời</p><h2 className="mt-3 text-2xl font-black text-white">Đặt nickname để vào phòng</h2><p className="mt-2 text-sm leading-6 text-slate-500">Nickname được lưu trong tab này để bạn refresh mà không bị tạo player trùng.</p><input autoFocus value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void join(); }} maxLength={20} placeholder="Tên hiển thị" className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[.05] px-4 py-3.5 text-white outline-none placeholder:text-slate-600 focus:border-mint/50" /><button onClick={join} disabled={joining} className="mt-3 w-full rounded-2xl bg-mint px-4 py-3.5 text-sm font-black text-ink transition hover:bg-white disabled:opacity-50">{joining ? "đang vào phòng…" : "tham gia phòng"}</button></section>}

      {room && me && room.status === "WAITING" && <WaitingRoom room={room} identity={identity} isHost={isHost} onReady={() => void run("ready", { ready: !me.ready })} onStart={() => void run("start")} onLeave={() => void leave()} onCopy={(text, message) => void copy(text, message)} />}
      {room && me && room.status !== "WAITING" && <TicTacToeGame room={room} playerId={identity.playerId} disabled={connection !== "online"} onAction={(position) => void run("action", { action: { type: "place-mark", payload: { position } } })} onRestart={() => void run("restart")} />}
      {error && <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral"><span>{error}</span><button onClick={() => setError(null)} className="text-xs font-bold uppercase tracking-wider">đóng</button></div>}
      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-mint/30 bg-[#101820] px-4 py-2.5 text-sm font-semibold text-mint shadow-2xl"><Check size={15} /> {toast}</div>}
    </div>
  </main>;
}

function WaitingRoom({ room, identity, isHost, onReady, onStart, onLeave, onCopy }: { room: RoomSnapshot; identity: ClientIdentity; isHost: boolean; onReady: () => void; onStart: () => void; onLeave: () => void; onCopy: (text: string, message: string) => void }) {
  const allReady = room.players.length >= 2 && room.players.every((player) => player.ready);
  const inviteLink = typeof window === "undefined" ? "" : `${window.location.origin}/room/${room.code}`;
  return <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-5 sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">mã phòng</p><div className="mt-2 flex items-center gap-3"><span className="font-mono text-4xl font-black tracking-[.18em] text-white">{room.code}</span><button aria-label="Copy mã phòng" onClick={() => onCopy(room.code, "Đã copy mã phòng")} className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition hover:border-mint/40 hover:text-mint"><Copy size={17} /></button></div><p className="mt-2 text-sm text-slate-500">Gửi mã này cho bạn bè để họ tham gia.</p></div><button onClick={() => onCopy(inviteLink, "Đã copy link mời")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-bold text-white transition hover:border-mint/40 hover:bg-white/5"><Clipboard size={16} /> copy link mời</button></div>
      <div className="mt-10 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-mint">người chơi</p><h2 className="mt-2 text-2xl font-black text-white">Đang chờ đồng đội <span className="text-slate-600">{room.players.length}/2</span></h2></div><span className="text-xs text-slate-500">{allReady ? "mọi người đã sẵn sàng" : "bật ready khi bạn vào vị trí"}</span></div>
      <div className="mt-5 space-y-3">{room.players.map((player) => <div key={player.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.025] px-4 py-3.5"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${player.id === identity.playerId ? "bg-mint text-ink" : "bg-lavender/10 text-lavender"}`}>{player.nickname.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{player.nickname} {player.id === identity.playerId && <span className="font-normal text-slate-500">(bạn)</span>}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">{player.isHost && <><Crown size={12} className="text-mint" /> host · </>}<span className={player.connected ? "text-mint" : "text-slate-600"}>{player.connected ? "online" : "offline"}</span></p></div></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${player.ready ? "bg-mint/10 text-mint" : "bg-white/5 text-slate-500"}`}>{player.ready ? "ready" : "đang chờ"}</span></div>)}</div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={onReady} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black transition ${room.players.find((player) => player.id === identity.playerId)?.ready ? "border border-mint/30 bg-mint/10 text-mint hover:bg-mint/15" : "bg-mint text-ink hover:bg-white"}`}><Check size={17} /> {room.players.find((player) => player.id === identity.playerId)?.ready ? "bỏ ready" : "tôi đã sẵn sàng"}</button>{isHost ? <button onClick={onStart} disabled={!allReady} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">bắt đầu ván <span>→</span></button> : <div className="flex items-center justify-center rounded-2xl border border-white/10 px-4 py-3.5 text-center text-xs text-slate-500">host sẽ bắt đầu khi đủ người</div>}</div>
    </div><aside className="space-y-5"><div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">luật phòng</p><div className="mt-5 space-y-4 text-sm leading-6 text-slate-400"><p><span className="font-bold text-white">01.</span> Cần đủ 2 người để bắt đầu Caro mini.</p><p><span className="font-bold text-white">02.</span> Mọi người đều ready, host mới có thể mở ván.</p><p><span className="font-bold text-white">03.</span> Refresh vẫn giữ đúng player trong tab này.</p></div></div><button onClick={onLeave} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-coral/20 bg-coral/[.06] px-4 py-3.5 text-sm font-bold text-coral transition hover:bg-coral/10"><LogOut size={17} /> rời phòng</button></aside></section>;
}
