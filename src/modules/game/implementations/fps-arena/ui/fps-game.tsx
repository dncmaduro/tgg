"use client";

import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@/modules/realtime/protocol";
import type { GameAction } from "@/modules/game/core/types";
import type { ClientIdentity } from "@/modules/identity/client";
import type { FpsArenaState, RoomSnapshot } from "@/types/domain";
import { FpsSimulation, type RuntimeCombatEvent, type RuntimePlayer } from "../engine/simulation";
import { FPS_RULES, directionFromRotation, type FpsInput, type FpsVector3 } from "../engine/rules";
import { ArenaMap } from "../world/arena-map";
import { FpsController, type FpsControllerApi } from "../player/fps-controller";
import { RemotePlayer } from "../player/remote-player";
import { WeaponView } from "../player/weapon";
import { FpsPeerManager, type PeerConnectionState, type Signal } from "../network/peer-manager";
import type { PeerMessage } from "../network/protocol";
import { FpsHud } from "./fps-hud";
import { MatchResult } from "./match-result";

type Props = {
  room: RoomSnapshot;
  identity: ClientIdentity;
  isHost: boolean;
  connection: "connecting" | "online" | "offline";
  sendRealtime: (message: ClientMessage) => boolean;
  subscribeRealtime: (listener: (message: ServerMessage) => void) => () => void;
  onAction: (action: GameAction) => void;
  onRestart: () => void;
  onLeave: () => void;
};

function getFpsState(room: RoomSnapshot): FpsArenaState | null {
  return room.gameId === "fps-arena" && room.gameState && "phase" in room.gameState ? room.gameState as FpsArenaState : null;
}

function getEffectivePhase(state: FpsArenaState | null, now: number): "CONNECTING" | "COUNTDOWN" | "PLAYING" | "FINISHED" {
  if (!state) return "CONNECTING";
  if (state.phase === "COUNTDOWN" && state.countdownEndsAt !== null && now >= state.countdownEndsAt) return "PLAYING";
  return state.phase;
}

function localPeerMessage(type: PeerMessage["type"], payload: Record<string, unknown> = {}): PeerMessage {
  return { type, ...payload } as PeerMessage;
}

export function FpsArenaGame({ room, identity, isHost, connection, sendRealtime, subscribeRealtime, onAction, onRestart, onLeave }: Props) {
  const fpsState = getFpsState(room);
  const [simulation] = useState(() => new FpsSimulation(room.players.map((player) => ({ id: player.id, nickname: player.nickname }))));
  const peerManagerRef = useRef<FpsPeerManager | null>(null);
  const controllerApiRef = useRef<FpsControllerApi | null>(null);
  const remoteInputsRef = useRef(new Map<string, FpsInput>());
  const remoteInputAtRef = useRef(new Map<string, number>());
  const inputSequenceRef = useRef(0);
  const lastRemoteSequenceRef = useRef(new Map<string, number>());
  const lastInputSentAtRef = useRef(0);
  const lastSnapshotSentAtRef = useRef(0);
  const lastUiUpdateAtRef = useRef(0);
  const processedFireIdsRef = useRef(new Set<string>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const finishSentRef = useRef(false);
  const beginSentRef = useRef(false);
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);
  const [players, setPlayers] = useState<RuntimePlayer[]>(() => simulation.getPlayers());
  const [peerStates, setPeerStates] = useState<Record<string, PeerConnectionState>>({});
  const [locked, setLocked] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [muzzleFlash, setMuzzleFlash] = useState(false);
  const [hitMarker, setHitMarker] = useState(false);
  const [killerName, setKillerName] = useState<string | null>(null);
  const [hostDisconnected, setHostDisconnected] = useState(false);
  const [hostPaused, setHostPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 700));

  const playerIdsKey = room.players.map((player) => player.id).join("|");
  const playerIds = useMemo(() => playerIdsKey ? playerIdsKey.split("|") : [], [playerIdsKey]);
  const playerNames = useMemo(() => new Map(room.players.map((player) => [player.id, player.nickname])), [room.players]);
  const handleCombat = useCallback((event: RuntimeCombatEvent): void => {
    if (event.shooterId === identity.playerId && event.targetId) {
      setHitMarker(true);
      window.setTimeout(() => setHitMarker(false), 120);
    }
    if (event.targetId === identity.playerId && event.killed) setKillerName(playerNames.get(event.shooterId) ?? "đối thủ");
  }, [identity.playerId, playerNames]);

  const handlePeerMessage = useCallback((fromPlayerId: string, message: PeerMessage) => {
    if (message.type === "input" && isHost) {
      if (!playerIds.includes(fromPlayerId)) return;
      const previousSequence = lastRemoteSequenceRef.current.get(fromPlayerId) ?? -1;
      if (message.input.seq <= previousSequence) return;
      lastRemoteSequenceRef.current.set(fromPlayerId, message.input.seq);
      remoteInputsRef.current.set(fromPlayerId, message.input);
      remoteInputAtRef.current.set(fromPlayerId, Date.now());
      return;
    }
    if (message.type === "fire" && isHost) {
      if (!playerIds.includes(fromPlayerId) || processedFireIdsRef.current.has(message.eventId)) return;
      processedFireIdsRef.current.add(message.eventId);
      if (processedFireIdsRef.current.size > 300) processedFireIdsRef.current.delete(processedFireIdsRef.current.values().next().value as string);
      const event = simulation.fire(fromPlayerId, message.direction, Date.now(), message.eventId);
      if (event) {
        peerManagerRef.current?.sendReliable(localPeerMessage("combat", { event }));
        if (event.shooterId === identity.playerId || event.targetId === identity.playerId) handleCombat(event);
      }
      return;
    }
    if (message.type === "snapshot" && !isHost) {
      if (simulation.applySnapshot(message.snapshot, identity.playerId)) setPlayers(simulation.getPlayers());
      return;
    }
    if (message.type === "combat") {
      handleCombat(message.event);
      return;
    }
    if (message.type === "resync" && isHost) {
      peerManagerRef.current?.sendUnreliable(localPeerMessage("snapshot", { snapshot: simulation.toSnapshot(Date.now(), Date.now()) }));
      return;
    }
    if (message.type === "host-paused" && !isHost) setHostPaused(message.paused);
  }, [handleCombat, identity.playerId, isHost, playerIds, simulation]);

  const callbacksRef = useRef({ handlePeerMessage });
  useEffect(() => {
    callbacksRef.current.handlePeerMessage = handlePeerMessage;
  }, [handlePeerMessage]);

  useEffect(() => {
    const onResize = () => setMobile(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 700);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (room.status === "WAITING" || room.status === "FINISHED" || connection === "offline") return;
    const manager = new FpsPeerManager({
      roomCode: room.code,
      identity,
      playerIds,
      hostId: room.hostId,
      isHost,
      onSignal: (targetPlayerId: string, signal: Signal) => {
        sendRealtime({ type: "webrtc:signal", code: room.code, identity, targetPlayerId, signal });
      },
      onMessage: (fromPlayerId, message) => callbacksRef.current.handlePeerMessage(fromPlayerId, message),
      onPeerState: (state) => setPeerStates((current) => ({ ...current, [state.playerId]: state })),
      onHostDisconnected: () => setHostDisconnected(true),
    });
    peerManagerRef.current = manager;
    manager.start();
    const unsubscribe = subscribeRealtime((message) => {
      if (message.type === "webrtc:signal" && message.code === room.code) void manager.handleSignal(message.fromPlayerId, message.signal).catch(() => undefined);
    });
    return () => {
      unsubscribe();
      manager.close();
      peerManagerRef.current = null;
    };
  }, [connection, identity, isHost, playerIds, room.code, room.hostId, room.status, sendRealtime, subscribeRealtime]);

  useEffect(() => {
    if (!isHost) return;
    const onVisibilityChange = () => {
      const paused = document.hidden;
      setHostPaused(paused);
      peerManagerRef.current?.sendReliable(localPeerMessage("host-paused", { paused }));
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isHost]);

  const expectedPeers = playerIds.filter((playerId) => playerId !== identity.playerId && (isHost || playerId === room.hostId)).length;
  const connectedPeers = Object.values(peerStates).filter((state) => state.status === "connected" && state.reliable && state.unreliable).length;
  const networkReady = expectedPeers > 0 && connectedPeers >= expectedPeers;
  const networkFailure = Object.values(peerStates).some((state) => state.status === "failed");
  const networkStatus = connection === "offline" ? "Signaling mất kết nối" : expectedPeers === 0 ? "Đang chờ người chơi" : networkFailure ? "WebRTC thất bại" : networkReady ? `WebRTC ${connectedPeers}/${expectedPeers}` : `Kết nối ${connectedPeers}/${expectedPeers}`;

  useEffect(() => {
    if (!isHost || !networkReady || !fpsState || fpsState.phase !== "CONNECTING" || beginSentRef.current || room.status !== "PLAYING") return;
    beginSentRef.current = true;
    onActionRef.current({ type: "fps-begin-match", payload: {} });
  }, [fpsState, isHost, networkReady, room.status]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  const effectivePhase = getEffectivePhase(fpsState, now);
  const active = effectivePhase === "PLAYING" && room.status === "PLAYING" && !hostDisconnected && !hostPaused;
  const endsAt = fpsState?.endsAt ?? null;
  const remainingMs = endsAt === null ? null : Math.max(0, endsAt - now);
  const countdown = effectivePhase === "COUNTDOWN" && fpsState?.countdownEndsAt ? Math.max(1, Math.ceil((fpsState.countdownEndsAt - now) / 1_000)) : null;

  const finishMatch = useCallback((reason: "score" | "time") => {
    if (!isHost || finishSentRef.current || room.status !== "PLAYING") return;
    finishSentRef.current = true;
    onActionRef.current({ type: "fps-finish-match", payload: { reason, scores: simulation.getScores() } });
  }, [isHost, room.status, simulation]);

  const playShotSound = () => {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    const audio = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = audio;
    void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(150, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(70, audio.currentTime + 0.06);
    gain.gain.setValueAtTime(0.045, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.07);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.07);
  };

  const handleFixedStep = (rawInput: FpsInput, dt: number, timestamp: number) => {
    if (!active) return;
    const input = { ...rawInput, seq: inputSequenceRef.current + 1 };
    inputSequenceRef.current += 1;
    simulation.setLook(identity.playerId, input);
    if (isHost) {
      simulation.step(identity.playerId, input, dt, timestamp);
      for (const playerId of playerIds) {
        if (playerId === identity.playerId) continue;
        const age = timestamp - (remoteInputAtRef.current.get(playerId) ?? 0);
        const remoteInput = age < 500 ? remoteInputsRef.current.get(playerId) : undefined;
        const fallback = remoteInput ?? { forward: 0, strafe: 0, sprint: false, jump: false, yaw: simulation.getPlayer(playerId)?.rotation.yaw ?? 0, pitch: 0, seq: 0 };
        simulation.step(playerId, fallback, dt, timestamp);
      }
      if (timestamp - lastSnapshotSentAtRef.current >= FPS_RULES.snapshotIntervalMs) {
        lastSnapshotSentAtRef.current = timestamp;
        peerManagerRef.current?.sendUnreliable(localPeerMessage("snapshot", { snapshot: simulation.toSnapshot(input.seq, timestamp) }));
      }
    } else {
      simulation.step(identity.playerId, input, dt, timestamp);
      if (timestamp - lastInputSentAtRef.current >= FPS_RULES.inputIntervalMs) {
        lastInputSentAtRef.current = timestamp;
        peerManagerRef.current?.sendUnreliable(localPeerMessage("input", { input }));
      }
    }
    if (timestamp - lastUiUpdateAtRef.current >= 80) {
      lastUiUpdateAtRef.current = timestamp;
      setPlayers(simulation.getPlayers());
    }
    if (isHost && (simulation.hasWinner() || (endsAt !== null && Date.now() >= endsAt))) finishMatch(simulation.hasWinner() ? "score" : "time");
  };

  const handleFire = (direction: FpsVector3) => {
    if (!active) return;
    playShotSound();
    setMuzzleFlash(true);
    window.setTimeout(() => setMuzzleFlash(false), 65);
    const eventId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    if (isHost) {
      const event = simulation.fire(identity.playerId, direction, Date.now(), eventId);
      if (event) {
        peerManagerRef.current?.sendReliable(localPeerMessage("combat", { event }));
        handleCombat(event);
      }
    } else {
      peerManagerRef.current?.sendReliable(localPeerMessage("fire", { eventId, direction, timestamp: Date.now() }));
    }
  };

  const localPlayer = players.find((player) => player.id === identity.playerId);
  const visibleRemotePlayers = players.filter((player) => player.id !== identity.playerId);
  const countdownState = effectivePhase === "COUNTDOWN" ? countdown : null;
  const requestPointerLock = () => controllerApiRef.current?.requestPointerLock();

  return <main className="fixed inset-0 overflow-hidden bg-[#1b2025]" aria-label="FPS Arena">
    <Canvas camera={{ position: [0, FPS_RULES.eyeHeight, 14], fov: 75, near: 0.05, far: 100 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
      <ArenaMap />
      {visibleRemotePlayers.map((player) => <RemotePlayer key={player.id} player={player} />)}
      <FpsController active={active} simulation={simulation} localPlayerId={identity.playerId} onFixedStep={handleFixedStep} onFire={handleFire} onLockedChange={setLocked} onScoreboardChange={setScoreboardOpen} apiRef={controllerApiRef} />
      <WeaponView muzzleFlash={muzzleFlash} />
    </Canvas>
    <FpsHud localPlayer={localPlayer} players={players} localPlayerId={identity.playerId} remainingMs={remainingMs} locked={locked} scoreboardOpen={scoreboardOpen} networkStatus={networkStatus} countdown={countdownState} hitMarker={hitMarker} hostDisconnected={hostDisconnected} hostPaused={hostPaused} networkFailure={networkFailure} mobile={mobile} onContinue={requestPointerLock} onLeave={onLeave} now={now} killerName={killerName} />
    {room.status === "FINISHED" && fpsState && <MatchResult room={room} state={fpsState} onRestart={onRestart} onLeave={onLeave} />}
  </main>;
}
