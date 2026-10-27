import type { ClientIdentity } from "@/modules/identity/client";
import type { webrtcSignalSchema } from "@/modules/realtime/protocol";
import { decodePeerMessage, encodePeerMessage, type PeerMessage } from "./protocol";

export type Signal = { kind: "offer" | "answer"; sdp: string } | { kind: "ice"; candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
type PeerStatus = "connecting" | "connected" | "failed" | "closed";
export type PeerConnectionState = { playerId: string; status: PeerStatus; reliable: boolean; unreliable: boolean };
type PeerEntry = {
  id: string;
  connection: RTCPeerConnection;
  reliable: RTCDataChannel | null;
  unreliable: RTCDataChannel | null;
  pendingCandidates: RTCIceCandidateInit[];
};

export type FpsPeerManagerOptions = {
  roomCode: string;
  identity: ClientIdentity;
  playerIds: string[];
  hostId: string;
  isHost: boolean;
  onSignal: (targetPlayerId: string, signal: Signal) => void;
  onMessage: (fromPlayerId: string, message: PeerMessage, reliable: boolean) => void;
  onPeerState: (state: PeerConnectionState) => void;
  onHostDisconnected: () => void;
};

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function iceServers(): RTCIceServer[] {
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (!turnUrl || !turnUsername || !turnCredential) return DEFAULT_ICE_SERVERS;
  return [...DEFAULT_ICE_SERVERS, { urls: turnUrl, username: turnUsername, credential: turnCredential }];
}

export class FpsPeerManager {
  private readonly peers = new Map<string, PeerEntry>();
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private closed = false;
  private readonly options: FpsPeerManagerOptions;

  constructor(options: FpsPeerManagerOptions) {
    this.options = options;
  }

  start(): void {
    if (this.closed) return;
    if (this.options.isHost) {
      for (const playerId of this.options.playerIds) {
        if (playerId !== this.options.identity.playerId) void this.createPeer(playerId, true);
      }
    }
  }

  close(): void {
    this.closed = true;
    for (const timer of this.retryTimers.values()) clearTimeout(timer);
    this.retryTimers.clear();
    for (const peer of this.peers.values()) peer.connection.close();
    this.peers.clear();
  }

  getConnectionStates(): PeerConnectionState[] {
    return [...this.peers.values()].map((peer) => this.stateFor(peer));
  }

  isReady(): boolean {
    const expected = this.options.playerIds.filter((playerId) => playerId !== this.options.identity.playerId && (this.options.isHost || playerId === this.options.hostId));
    return expected.length > 0 && expected.every((playerId) => {
      const peer = this.peers.get(playerId);
      return Boolean(peer?.connection.connectionState === "connected" && peer.reliable?.readyState === "open" && peer.unreliable?.readyState === "open");
    });
  }

  sendUnreliable(message: PeerMessage): void {
    this.send(message, false);
  }

  sendReliable(message: PeerMessage): void {
    this.send(message, true);
  }

  async handleSignal(fromPlayerId: string, rawSignal: typeof webrtcSignalSchema._output): Promise<void> {
    if (this.closed || fromPlayerId === this.options.identity.playerId) return;
    const signal = rawSignal as Signal;
    let peer = this.peers.get(fromPlayerId);
    if (signal.kind === "offer") {
      peer ??= await this.createPeer(fromPlayerId, false);
      if (peer.connection.signalingState === "stable" && peer.connection.remoteDescription?.type === "offer") return;
      try {
        await peer.connection.setRemoteDescription({ type: "offer", sdp: signal.sdp });
      } catch {
        return;
      }
      for (const candidate of peer.pendingCandidates.splice(0)) await peer.connection.addIceCandidate(candidate).catch(() => undefined);
      const answer = await peer.connection.createAnswer();
      await peer.connection.setLocalDescription(answer);
      if (peer.connection.localDescription?.sdp) this.sendSignal(fromPlayerId, { kind: "answer", sdp: peer.connection.localDescription.sdp });
      return;
    }
    if (!peer && signal.kind === "ice") peer = await this.createPeer(fromPlayerId, false);
    if (!peer) return;
    if (signal.kind === "answer") {
      if (peer.connection.signalingState !== "have-local-offer") return;
      try {
        await peer.connection.setRemoteDescription({ type: "answer", sdp: signal.sdp });
      } catch {
        return;
      }
      for (const candidate of peer.pendingCandidates.splice(0)) await peer.connection.addIceCandidate(candidate).catch(() => undefined);
      return;
    }
    if (signal.kind !== "ice") return;
    const candidate: RTCIceCandidateInit = { candidate: signal.candidate, sdpMid: signal.sdpMid ?? null, sdpMLineIndex: signal.sdpMLineIndex ?? null };
    if (peer.connection.remoteDescription) await peer.connection.addIceCandidate(candidate).catch(() => undefined);
    else peer.pendingCandidates.push(candidate);
  }

  private async createPeer(playerId: string, initiator: boolean): Promise<PeerEntry> {
    const previous = this.peers.get(playerId);
    if (previous) return previous;
    const connection = new RTCPeerConnection({ iceServers: iceServers() });
    const peer: PeerEntry = { id: playerId, connection, reliable: null, unreliable: null, pendingCandidates: [] };
    this.peers.set(playerId, peer);
    connection.onicecandidate = (event) => {
      if (!event.candidate) return;
      this.sendSignal(playerId, {
        kind: "ice",
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      });
    };
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      if (state === "failed" || state === "disconnected") this.scheduleRetry(playerId);
      if (state === "closed" && playerId === this.options.hostId && !this.options.isHost) this.options.onHostDisconnected();
      this.emitState(peer, state === "connected" ? "connected" : state === "failed" ? "failed" : state === "closed" ? "closed" : "connecting");
    };
    connection.ondatachannel = (event) => this.attachChannel(peer, event.channel);
    if (initiator) {
      this.attachChannel(peer, connection.createDataChannel("fps-reliable"));
      this.attachChannel(peer, connection.createDataChannel("fps-unreliable", { ordered: false, maxRetransmits: 0 }));
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      if (connection.localDescription?.sdp) this.sendSignal(playerId, { kind: "offer", sdp: connection.localDescription.sdp });
    }
    this.emitState(peer, "connecting");
    return peer;
  }

  private attachChannel(peer: PeerEntry, channel: RTCDataChannel): void {
    if (channel.label === "fps-reliable") peer.reliable = channel;
    else if (channel.label === "fps-unreliable") peer.unreliable = channel;
    else return;
    channel.onopen = () => {
      this.emitState(peer, "connected");
      this.sendOnChannel(peer, { type: "hello", playerId: this.options.identity.playerId, nickname: this.options.identity.nickname }, channel);
      if (!this.options.isHost && channel.label === "fps-reliable") this.sendOnChannel(peer, { type: "resync" }, channel);
    };
    channel.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      if (event.data.length > 8 * 1024) return;
      const message = decodePeerMessage(event.data);
      if (message) this.options.onMessage(peer.id, message, channel.label === "fps-reliable");
    };
    channel.onclose = () => {
      this.emitState(peer, "closed");
      if (this.peers.get(peer.id) === peer) this.peers.delete(peer.id);
      if (peer.id === this.options.hostId && !this.options.isHost) this.options.onHostDisconnected();
    };
  }

  private send(message: PeerMessage, reliable: boolean): void {
    for (const peer of this.peers.values()) {
      const channel = reliable ? peer.reliable : peer.unreliable;
      this.sendOnChannel(peer, message, channel, !reliable);
    }
  }

  private sendOnChannel(peer: PeerEntry, message: PeerMessage, channel: RTCDataChannel | null, unreliable = false): void {
    if (!channel || channel.readyState !== "open") return;
    if (unreliable && channel.bufferedAmount > 64 * 1024) return;
    try {
      channel.send(encodePeerMessage(message));
    } catch {
      this.emitState(peer, "failed");
    }
  }

  private sendSignal(targetPlayerId: string, signal: Signal): void {
    if (this.closed) return;
    this.options.onSignal(targetPlayerId, signal);
  }

  private scheduleRetry(playerId: string): void {
    if (this.closed || this.retryTimers.has(playerId)) return;
    const timer = setTimeout(() => {
      this.retryTimers.delete(playerId);
      const peer = this.peers.get(playerId);
      peer?.connection.close();
      this.peers.delete(playerId);
      if (this.options.isHost) void this.createPeer(playerId, true);
    }, 1_000);
    this.retryTimers.set(playerId, timer);
  }

  private stateFor(peer: PeerEntry): PeerConnectionState {
    return { playerId: peer.id, status: peer.connection.connectionState === "connected" ? "connected" : "connecting", reliable: peer.reliable?.readyState === "open", unreliable: peer.unreliable?.readyState === "open" };
  }

  private emitState(peer: PeerEntry, status: PeerStatus): void {
    this.options.onPeerState({ ...this.stateFor(peer), status });
  }
}
