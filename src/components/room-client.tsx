"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, Copy, Crown, Link2, LogOut, RefreshCw, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NicknameDialog } from "@/components/nickname-dialog";
import { TicTacToeGame } from "@/components/tic-tac-toe";
import { WordChainGame } from "@/components/word-chain-game";
import { useRoom } from "@/hooks/use-room";
import type { GameAction } from "@/modules/game/core/types";
import { getClientIdentity, updateNickname, type ClientIdentity } from "@/modules/identity/client";
import type { RoomSnapshot } from "@/types/domain";

const FpsArenaGame = dynamic(() => import("@/modules/game/implementations/fps-arena/ui/fps-game").then((module) => module.FpsArenaGame), { ssr: false });

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [identity, setIdentity] = useState<ClientIdentity>({ playerId: "", credential: "", nickname: "" });
  const [toast, setToast] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const { room, setRoom, connection, loading, error, setError, mutate, sendRealtime, subscribeRealtime } = useRoom(code, identity);

  useEffect(() => {
    queueMicrotask(() => setIdentity(getClientIdentity()));
  }, []);

  const me = useMemo(() => room?.players.find((player) => player.id === identity.playerId), [room, identity.playerId]);
  const isHost = Boolean(me?.isHost && room?.hostId === identity.playerId);
  const needsNickname = Boolean(room && !me);
  const sendGameAction = useCallback((action: GameAction) => mutate("action", { action }), [mutate]);
  const sendFpsAction = useCallback(async (action: GameAction) => {
    try {
      await mutate("action", { action });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật trận đấu.");
    }
  }, [mutate, setError]);

  const run = async (intent: "ready" | "start" | "action" | "restart" | "leave", extras: Record<string, unknown> = {}) => {
    try {
      await mutate(intent, extras);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật phòng.");
    }
  };

  const join = async (nickname: string) => {
    if (joining) return;
    setJoining(true);
    const nextIdentity = updateNickname(nickname);
    try {
      const response = await fetch(`/api/rooms/${code}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "join", identity: nextIdentity }),
      });
      const body = await response.json() as { room?: RoomSnapshot; error?: { message?: string } };
      if (!response.ok || !body.room) throw new Error(body.error?.message ?? "Không thể tham gia phòng.");
      setIdentity(nextIdentity);
      setRoom(body.room);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tham gia phòng.");
    } finally {
      setJoining(false);
    }
  };

  const copy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast(message);
      window.setTimeout(() => setToast(null), 2_000);
    } catch {
      setError("Không thể sao chép trên trình duyệt này.");
    }
  };

  const leave = async () => {
    await run("leave");
    router.push("/");
  };

  if (loading && !room) {
    return <div className="flex min-h-screen items-center justify-center px-5"><div className="flex items-center gap-3 text-sm text-slate-400"><RefreshCw size={16} className="animate-spin text-mint" /> Đang mở phòng…</div></div>;
  }

  if (!room) {
    return <main className="flex min-h-screen items-center justify-center px-5"><section className="w-full max-w-sm text-center"><p className="text-sm text-red-300" role="alert">{error ?? "Không tìm thấy phòng."}</p><button type="button" onClick={() => router.push("/")} className="mt-5 rounded-xl bg-mint px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white">Về trang chủ</button></section></main>;
  }

  const inviteLink = typeof window === "undefined" ? "" : `${window.location.origin}/room/${room.code}`;
  const displayError = needsNickname ? null : error;

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white" aria-label="MiniPlay trang chủ">MiniPlay</Link>
        <button type="button" onClick={() => router.push("/")} className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-white"><ArrowLeft size={16} /> Trang chủ</button>
      </header>

      <div className="mx-auto max-w-6xl pb-20 pt-12">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-slate-500">Phòng {room.code}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{room.gameTitle}</h1>
            <p className="mt-2 text-sm text-slate-500">{room.gameDescription}</p>
          </div>
          <ConnectionStatus state={connection} />
        </div>

        {room.status === "WAITING" && me && <WaitingRoom room={room} identity={identity} isHost={isHost} onReady={() => void run("ready", { ready: !me.ready })} onStart={() => void run("start")} onLeave={() => void leave()} onCopy={(value, message) => void copy(value, message)} />}
        {room.status !== "WAITING" && me && room.gameId === "tic-tac-toe" && <TicTacToeGame room={room} playerId={identity.playerId} isHost={isHost} disabled={connection !== "online"} onAction={(position) => void sendGameAction({ type: "place-mark", payload: { position } })} onRestart={() => void run("restart")} onLeave={() => void leave()} />}
        {room.status !== "WAITING" && me && room.gameId === "word-chain" && <WordChainGame room={room} playerId={identity.playerId} isHost={isHost} disabled={connection !== "online"} onAction={sendGameAction} onRestart={() => void run("restart")} onLeave={() => void leave()} />}
        {room.status !== "WAITING" && me && room.gameId === "fps-arena" && <FpsArenaGame room={room} identity={identity} isHost={isHost} connection={connection} sendRealtime={sendRealtime} subscribeRealtime={subscribeRealtime} onAction={sendFpsAction} onRestart={() => void run("restart")} onLeave={() => void leave()} />}

        {displayError && <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"><span>{displayError}</span><button type="button" onClick={() => setError(null)} className="text-xs font-semibold text-red-100">Đóng</button></div>}
        {toast && <div role="status" className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-mint/30 bg-panel px-4 py-2.5 text-sm font-semibold text-mint"><Check size={15} /> {toast}</div>}
      </div>

      <NicknameDialog key={`${room.code}-${identity.nickname}`} open={needsNickname} initialNickname={identity.nickname} busy={joining} onCancel={() => { if (!joining) router.push("/"); }} onSubmit={(nickname) => void join(nickname)} />
    </main>
  );
}

function ConnectionStatus({ state }: { state: "connecting" | "online" | "offline" }) {
  const connected = state === "online";
  const connecting = state === "connecting";
  return <div className={`inline-flex items-center gap-2 text-xs ${connected ? "text-mint" : "text-slate-500"}`}>
    {connected ? <span className="h-2 w-2 rounded-full bg-mint" /> : connecting ? <RefreshCw size={14} className="animate-spin" /> : <WifiOff size={14} />}
    {connected ? "Đã kết nối" : connecting ? "Đang kết nối" : "Mất kết nối — đang thử lại"}
  </div>;
}

function WaitingRoom({ room, identity, isHost, onReady, onStart, onLeave, onCopy }: { room: RoomSnapshot; identity: ClientIdentity; isHost: boolean; onReady: () => void; onStart: () => void; onLeave: () => void; onCopy: (value: string, message: string) => void }) {
  const currentPlayer = room.players.find((player) => player.id === identity.playerId);
  const allReady = room.players.length >= room.minPlayers && room.players.every((player) => player.ready);
  const inviteLink = typeof window === "undefined" ? "" : `${window.location.origin}/room/${room.code}`;

  return <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
    <div className="rounded-2xl border border-line bg-panel p-5 sm:p-7">
      <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-slate-400">Người chơi</p><h2 className="mt-1 text-2xl font-semibold text-white">{room.players.length}/{room.maxPlayers}</h2></div><p className="text-right text-sm text-slate-500">{allReady ? "Mọi người đã sẵn sàng" : `Cần ít nhất ${room.minPlayers} người`}</p></div>
      <div className="mt-5 space-y-2">
        {room.players.map((player) => <div key={player.id} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
          <div className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${player.id === identity.playerId ? "bg-mint text-ink" : "bg-ink text-slate-300"}`}>{player.nickname.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{player.nickname} {player.id === identity.playerId && <span className="font-normal text-slate-500">(bạn)</span>}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">{player.isHost && <><Crown size={12} className="text-mint" /> Chủ phòng · </>}{player.connected ? "Đã vào" : "Đã rời"}</p></div></div>
          <span className={`shrink-0 text-xs ${player.ready ? "text-mint" : "text-slate-500"}`}>{player.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}</span>
        </div>)}
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onReady} className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${currentPlayer?.ready ? "border border-mint/40 text-mint hover:bg-mint/10" : "bg-mint text-ink hover:bg-white"}`}><Check size={16} className="mr-2 inline" />{currentPlayer?.ready ? "Bỏ sẵn sàng" : "Sẵn sàng"}</button>
        {isHost ? <button type="button" onClick={onStart} disabled={!allReady} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Bắt đầu</button> : <p className="flex items-center justify-center rounded-xl border border-line px-4 py-3 text-center text-xs text-slate-500">Chờ chủ phòng bắt đầu</p>}
      </div>
      {isHost && !allReady && <p className="mt-3 text-xs text-slate-500">Cần đủ {room.minPlayers} người và mọi người sẵn sàng.</p>}
    </div>

    <aside className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-sm font-medium text-slate-400">Mã phòng</p>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-[.16em] text-white">{room.code}</p>
      <div className="mt-5 grid gap-2"><button type="button" aria-label="Sao chép mã phòng" onClick={() => onCopy(room.code, "Đã sao chép mã phòng")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm text-white transition hover:border-mint hover:bg-white/5"><Copy size={16} /> Sao chép mã</button><button type="button" onClick={() => onCopy(inviteLink, "Đã sao chép link mời")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm text-white transition hover:border-mint hover:bg-white/5"><Link2 size={16} /> Mời bạn bè</button></div>
      <button type="button" onClick={onLeave} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"><LogOut size={16} /> Rời phòng</button>
    </aside>
  </section>;
}
