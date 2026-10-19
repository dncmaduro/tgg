"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientIdentity } from "@/modules/identity/client";
import type { RoomSnapshot } from "@/types/domain";
import type { ServerMessage } from "@/modules/realtime/protocol";

type ConnectionState = "connecting" | "online" | "offline";
type Intent = "join" | "ready" | "start" | "action" | "restart" | "leave";

function getWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname === "localhost"
    ? `127.0.0.1${window.location.port ? `:${window.location.port}` : ""}`
    : window.location.host;
  return `${protocol}://${host}/api/ws`;
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
    const body = await response.json() as { room?: RoomSnapshot; error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message ?? "Không thể cập nhật phòng.");
    if (body.room) setRoom(body.room);
    setError(null);
    return body.room ?? null;
  }, [code, identity]);

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
        retryRef.current = 1_000;
        setConnection("online");
        socket.send(JSON.stringify({ type: "room:subscribe", code, identity }));
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as ServerMessage;
          if (message.type === "room:subscribed" || message.type === "room:updated") {
            setRoom(message.room);
            setError(null);
          }
          if (message.type === "system:error") setError(message.message);
        } catch {
          setError("Nhận dữ liệu realtime không hợp lệ.");
        }
      };
      socket.onclose = () => {
        if (stoppedRef.current) return;
        setConnection("offline");
        reconnectTimerRef.current = setTimeout(connect, retryRef.current);
        retryRef.current = Math.min(retryRef.current * 2, 30_000);
      };
      socket.onerror = () => setConnection("offline");
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

  return { room, setRoom, connection, loading, error, setError, refresh, mutate };
}
