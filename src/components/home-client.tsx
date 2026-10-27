"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Link2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NicknameDialog } from "@/components/nickname-dialog";
import { gameRegistry, type GameDefinition } from "@/modules/game/registry";
import { getClientIdentity, updateNickname, type ClientIdentity } from "@/modules/identity/client";

type PendingAction =
  | { type: "create"; gameId: GameDefinition["id"] }
  | { type: "join"; code: string };

type RoomResponse = { room?: { code: string }; error?: { message?: string } };

export function HomeClient() {
  const router = useRouter();
  const [identity, setIdentity] = useState<ClientIdentity>({ playerId: "", credential: "", nickname: "" });
  const [roomCode, setRoomCode] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setIdentity(getClientIdentity()));
  }, []);

  const openCreate = (gameId: GameDefinition["id"]) => {
    setError(null);
    setPending({ type: "create", gameId });
  };

  const checkAndOpenJoin = async () => {
    const code = roomCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Mã phòng phải có 6 chữ số.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      const body = await response.json() as RoomResponse;
      if (!response.ok || !body.room) throw new Error(body.error?.message ?? "Không tìm thấy phòng.");
      setPending({ type: "join", code });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tìm thấy phòng.");
    } finally {
      setBusy(false);
    }
  };

  const continueToRoom = async (nickname: string) => {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    const nextIdentity = updateNickname(nickname);
    try {
      const response = pending.type === "create"
        ? await fetch("/api/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ gameId: pending.gameId, identity: nextIdentity }),
        })
        : await fetch(`/api/rooms/${pending.code}/actions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intent: "join", identity: nextIdentity }),
        });
      const body = await response.json() as RoomResponse;
      if (!response.ok || !body.room) throw new Error(body.error?.message ?? "Không thể vào phòng.");
      setIdentity(nextIdentity);
      setPending(null);
      router.push(`/room/${body.room.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể vào phòng.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white" aria-label="MiniPlay trang chủ">MiniPlay</Link>
        <span className="text-sm text-slate-500">Caro mini</span>
      </header>

      <div className="mx-auto max-w-5xl pb-16 pt-16 sm:pt-24">
        <section className="max-w-xl">
          <p className="text-sm font-medium text-slate-400">Tham gia phòng</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Chơi cùng bạn bè</h1>
          <form onSubmit={(event) => { event.preventDefault(); void checkAndOpenJoin(); }} className="mt-7 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="room-code">Mã phòng gồm 6 số</label>
            <input
              id="room-code"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Mã phòng gồm 6 số"
              inputMode="numeric"
              className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-3.5 py-3 text-sm tracking-[.2em] text-white outline-none transition placeholder:tracking-normal placeholder:text-slate-600 focus:border-mint"
            />
            <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm font-medium text-white transition hover:border-mint hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"><Link2 size={16} /> Tham gia</button>
          </form>
          {error && <p className="mt-3 text-sm text-red-300" role="alert">{error}</p>}
        </section>

        <section className="mt-16" aria-labelledby="games-title">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="games-title" className="text-xl font-semibold text-white">Trò chơi</h2>
            <span className="text-sm text-slate-500">Chọn game để tạo phòng</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gameRegistry.map((game) => {
              const available = game.status === "available";
              return (
                <article key={game.id} className="flex min-h-40 flex-col rounded-2xl border border-line bg-panel p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-lg text-slate-300" aria-hidden="true">{game.icon}</span>
                    {!available && <span className="text-xs text-slate-500">Sắp ra mắt</span>}
                  </div>
                  <h3 className="mt-5 font-medium text-white">{game.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{game.description}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    <span className="text-xs text-slate-500">{game.minPlayers}–{game.maxPlayers} người</span>
                    <button type="button" disabled={!available || busy} onClick={() => openCreate(game.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-mint transition hover:bg-mint/10 disabled:cursor-not-allowed disabled:text-slate-600">{available ? "Tạo phòng" : "Sắp ra mắt"}{available && <ArrowRight size={15} />}</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <NicknameDialog
        key={pending ? `${pending.type}-${pending.type === "create" ? pending.gameId : pending.code}` : "closed"}
        open={pending !== null}
        initialNickname={identity.nickname}
        busy={busy}
        onCancel={() => { if (!busy) setPending(null); }}
        onSubmit={(nickname) => void continueToRoom(nickname)}
      />
    </main>
  );
}
