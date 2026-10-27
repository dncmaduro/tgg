# Realtime protocol

Endpoint: `GET /ws` over `ws://` with the local Node adapter; the Vercel deployment endpoint is `GET /api/ws` over `wss://`.

## Client → server

```json
{
  "type": "room:subscribe",
  "code": "123456",
  "identity": {
    "playerId": "uuid",
    "credential": "tab-secret",
    "nickname": "Mèo Lười"
  }
}
```

The currently implemented client messages are:

- `room:subscribe` — authorize the player, mark presence online, and receive a snapshot.
- `room:leave` — leave explicitly and transfer host if necessary.

Game mutations use HTTP `POST /api/rooms/:code/actions`; this keeps command validation and optimistic concurrency in one place. The WebSocket then distributes the resulting snapshot.

## Server → client

- `room:subscribed` — initial snapshot for the socket.
- `room:updated` — a newer snapshot, including a monotonically increasing `revision`.
- `system:error` — typed error code and user-facing message.

Example:

```json
{
  "type": "room:updated",
  "room": {
    "code": "123456",
    "status": "PLAYING",
    "revision": 8
  }
}
```

Clients reconnect with exponential backoff (1s, doubling to a 30s ceiling), resubscribe with the same identity, and replace local state with the latest server snapshot. A disconnected player remains in the room and is marked offline until the TTL cleans up the room.
