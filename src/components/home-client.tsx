"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Gamepad2, Link2, Radio, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gameRegistry } from "@/modules/game/registry";
import { getClientIdentity, updateNickname, type ClientIdentity } from "@/modules/identity/client";

type Health = { ok: boolean; storage: "redis" | "memory"; productionReady: boolean; realtime: string; error?: { message?: string } };

export function HomeClient() {
  const router = useRouter();
  const [identity, setIdentity] = useState<ClientIdentity>({ playerId: "", credential: "", nickname: "" });
  const [roomCode, setRoomCode] = useState("");
  const [selectedGame, setSelectedGame] = useState("tic-tac-toe");
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setIdentity(getClientIdentity()));
    void fetch("/api/health").then((response) => response.json() as Promise<Health>).then(setHealth).catch(() => undefined);
  }, []);

  const setName = (nickname: string) => setIdentity(updateNickname(nickname));

  const createRoom = async () => {
    if (!identity.nickname.trim()) return setError("Nhập nickname trước khi tạo phòng nhé.");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gameId: selectedGame, identity }) });
      const body = await response.json() as { room?: { code: string }; error?: { message?: string } };
      if (!response.ok || !body.room) throw new Error(body.error?.message ?? "Không thể tạo phòng.");
      router.push(`/room/${body.room.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo phòng.");
    } finally { setBusy(false); }
  };

  const joinRoom = async () => {
    if (!identity.nickname.trim()) return setError("Nhập nickname trước khi tham gia phòng nhé.");
    const code = roomCode.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) return setError("Mã phòng cần đủ 6 chữ số.");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${code}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intent: "join", identity }) });
      const body = await response.json() as { room?: { code: string }; error?: { message?: string } };
      if (!response.ok || !body.room) throw new Error(body.error?.message ?? "Không thể tham gia phòng.");
      router.push(`/room/${body.room.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tham gia phòng.");
    } finally { setBusy(false); }
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-6 sm:px-8">
      <div className="grid-noise pointer-events-none absolute inset-x-0 top-0 h-[620px] opacity-70" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-white" aria-label="MiniPlay trang chủ">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-mint/30 bg-mint/10 text-mint shadow-[0_0_28px_rgba(159,243,199,.14)]"><Gamepad2 size={21} /></span>
          <span className="text-lg font-black tracking-[-0.04em]">Mini<span className="text-mint">Play</span></span>
        </Link>
        <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><Radio size={14} className="text-mint" /> phòng realtime · 2–10 người</div>
      </header>

      <section className="relative mx-auto grid max-w-6xl gap-12 pb-16 pt-20 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:pt-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/5 px-3 py-1.5 text-xs font-semibold text-mint"><Sparkles size={14} /> bật game, gọi hội</div>
          <h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-0.065em] text-white sm:text-7xl">Một phòng.<br /><span className="text-mint">Cả nhóm vui.</span></h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">MiniPlay gom những mini game đủ nhanh để vào trận ngay, đủ thân thiện để ai cũng chơi được. Không tài khoản, không vòng vo.</p>

          <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-[1fr_auto]">
            <label className="rounded-2xl border border-white/10 bg-white/[.045] p-3 transition focus-within:border-mint/50">
              <span className="block px-1 text-[11px] font-bold uppercase tracking-[.18em] text-slate-500">Nickname của bạn</span>
              <input value={identity.nickname} onChange={(event) => setName(event.target.value)} placeholder="ví dụ: Mèo Lười" maxLength={20} className="mt-1 w-full bg-transparent px-1 text-base text-white outline-none placeholder:text-slate-600" />
            </label>
            <button onClick={joinRoom} disabled={busy} className="flex min-h-[72px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-bold text-white transition hover:border-mint/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"><Link2 size={17} /> vào mã phòng</button>
          </div>
          <div className="mt-3 flex max-w-xl gap-3">
            <input aria-label="Mã phòng" value={roomCode} onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => { if (event.key === "Enter") void joinRoom(); }} placeholder="MÃ PHÒNG 6 SỐ" inputMode="numeric" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[.045] px-4 py-3 text-sm font-bold tracking-[.25em] text-white outline-none placeholder:text-slate-600 focus:border-mint/50" />
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><Users size={14} /> mỗi tab là một người chơi</div>
          </div>
        </div>

        <div className="relative rounded-[2rem] border border-white/10 bg-white/[.045] p-3 shadow-glow lg:rotate-1">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#0e121a] p-6 sm:p-8">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">phòng của bạn</p><p className="mt-2 text-2xl font-black tracking-tight text-white">Chọn một game để bắt đầu</p></div><div className="rounded-xl bg-lavender/10 p-2.5 text-lavender"><Gamepad2 size={20} /></div></div>
            <div className="mt-7 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-mint/30 bg-mint/[.08] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-lg font-black text-ink">✦</div><div><p className="font-bold text-white">Caro mini</p><p className="text-xs text-slate-500">2 người · realtime</p></div></div><span className="rounded-full bg-mint/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mint">sẵn sàng</span></div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lavender/10 text-lg text-lavender">☾</div><div><p className="font-bold text-white">Ma sói</p><p className="text-xs text-slate-500">5–10 người</p></div></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">sắp ra mắt</span></div>
            </div>
            <div className="mt-6 flex items-center gap-3 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_12px_#9ff3c7]" /> kết nối an toàn · không cần đăng nhập</div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl pb-20" id="games">
        <div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-mint">Game library</p><h2 className="mt-2 text-2xl font-black tracking-tight text-white">Chọn trò, gọi bạn</h2></div><p className="hidden text-sm text-slate-500 sm:block">Không game nào bị bỏ lại phía sau.</p></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gameRegistry.map((game) => {
            const available = game.status === "available";
            const selected = selectedGame === game.id;
            return <button key={game.id} disabled={!available} onClick={() => setSelectedGame(game.id)} className={`group relative text-left rounded-3xl border p-5 transition ${selected ? "border-mint/50 bg-mint/[.08] shadow-[0_10px_50px_rgba(159,243,199,.08)]" : "border-white/10 bg-white/[.035] hover:border-white/20 hover:bg-white/[.06]"} ${!available ? "cursor-not-allowed opacity-65" : ""}`}>
              <div className="flex items-start justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${available ? "bg-white/10 text-mint" : "bg-white/5 text-slate-500"}`}>{game.icon}</span>{available ? <span className="rounded-full bg-mint/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mint">chơi được</span> : <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">sắp ra mắt</span>}</div>
              <h3 className="mt-5 text-lg font-black text-white">{game.title}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{game.description}</p><div className="mt-5 flex items-center justify-between text-xs text-slate-500"><span className="flex items-center gap-1.5"><Users size={14} /> {game.minPlayers}–{game.maxPlayers} người</span>{selected && available ? <span className="flex items-center gap-1 font-bold text-mint"><Check size={14} /> đã chọn</span> : <ArrowRight size={16} className="transition group-hover:translate-x-1" />}</div>
            </button>;
          })}
        </div>
        {error && <div role="alert" className="mt-5 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</div>}
        <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm sm:flex-row sm:items-center"><span className="text-slate-400">{health?.storage === "redis" ? (health.ok ? "Redis đang đồng bộ state giữa các instance." : health.error?.message ?? "Redis production chưa sẵn sàng.") : health?.ok === false ? health.error?.message ?? "Redis là bắt buộc trong production." : "Local-only: chưa có REDIS_URL, state đang nằm trong memory của process."}</span><button onClick={createRoom} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2.5 text-sm font-black text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "đang mở phòng…" : "tạo phòng mới"}<ArrowRight size={16} /></button></div>
      </section>
      <footer className="relative mx-auto flex max-w-6xl items-center justify-between border-t border-white/10 py-6 text-xs text-slate-600"><span>MiniPlay · phase 1 foundation</span><span className="hidden sm:block">WebSocket realtime · server authoritative</span></footer>
    </main>
  );
}
