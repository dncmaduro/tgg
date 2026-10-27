"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientIdentity } from "@/modules/identity/client";
import type { RoomSnapshot } from "@/types/domain";
import type { ClientMessage, ServerMessage } from "@/modules/realtime/protocol";

type ConnectionState = "connecting" | "online" | "offline";
type Intent = "join" | "ready" | "start" | "action" | "restart" | "leave";
type RealtimeListener = (message: ServerMessage) => void;

export class RoomMutationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "RoomMutationError";
  }
}

function debugSocket(event: string, details: Record<string, unknown> = {}): void {
  if (typeof window !== "undefined" && window.localStorage.getItem("miniplay:debug-ws") === "1") {
    console.error(`[MiniPlay browser ws] ${event}`, details);
  }
}

function getWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const local = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return `${protocol}://${window.location.host}${local ? "/ws" : "/api/ws"}`;
}

export function useRoom(code: string, identity: ClientIdentity) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(1_000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const listenersRef = useRef(new Set<RealtimeListener>());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      const body = await response.json() as { room?: RoomSnapshot; error?: { message?: string } };
      if (!response.ok || !body.room) throw new Error(body.error?.message ?? "Không thể tải phòng.");
      setRoom(body.room);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải phòng.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  const mutate = useCallback(async (intent: Intent, extras: Record<string, unknown> = {}) => {
    const response = await fetch(`/api/rooms/${code}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent, identity, ...extras }),
    });
    const body = await response.json() as { room?: RoomSnapshot; error?: { code?: string; message?: string } };
    if (!response.ok) throw new RoomMutationError(body.error?.code ?? "ROOM_ACTION_FAILED", body.error?.message ?? "Không thể cập nhật phòng.");
    if (body.room) setRoom(body.room);
    setError(null);
    return body.room ?? null;
  }, [code, identity]);

  const sendRealtime = useCallback((message: ClientMessage): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const subscribeRealtime = useCallback((listener: RealtimeListener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  useEffect(() => {
    stoppedRef.current = false;
    const loadTimer = window.setTimeout(() => void refresh(), 0);
    return () => {
      stoppedRef.current = true;
      window.clearTimeout(loadTimer);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (!identity.playerId || !identity.credential || !identity.nickname) return;
    stoppedRef.current = false;
    let socket: WebSocket;
    const connect = () => {
      if (stoppedRef.current) return;
      setConnection("connecting");
      socket = new WebSocket(getWebSocketUrl());
      socketRef.current = socket;
      socket.onopen = () => {
        debugSocket("open", { code });
        retryRef.current = 1_000;
        setConnection("online");
        socket.send(JSON.stringify({ type: "room:subscribe", code, identity }));
      };
      socket.onmessage = (event) => {
        debugSocket("message", { bytes: String(event.data).length });
        try {
          const message = JSON.parse(event.data as string) as ServerMessage;
          if (message.type === "room:subscribed" || message.type === "room:updated") {
            setRoom((current) => current && current.revision > message.room.revision ? current : message.room);
            setError(null);
          }
          if (message.type === "system:error") setError(message.message);
          for (const listener of listenersRef.current) listener(message);
        } catch {
          setError("Nhận dữ liệu realtime không hợp lệ.");
        }
      };
      socket.onclose = (event) => {
        debugSocket("close", { code: event.code, reason: event.reason, wasClean: event.wasClean });
        if (stoppedRef.current) return;
        setConnection("offline");
        reconnectTimerRef.current = setTimeout(connect, retryRef.current);
        retryRef.current = Math.min(retryRef.current * 2, 30_000);
      };
      socket.onerror = (event) => {
        debugSocket("error", { type: event.type });
        setConnection("offline");
      };
    };
    connect();
    return () => {
      stoppedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socket?.close();
    };
  // The socket should be replaced when the room identity changes, not for every snapshot revision.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, identity.playerId, identity.credential, identity.nickname]);

  return { room, setRoom, connection, loading, error, setError, refresh, mutate, sendRealtime, subscribeRealtime };
}
