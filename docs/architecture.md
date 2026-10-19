# MiniPlay architecture

MiniPlay keeps the multiplayer core independent from React and transport details.

```text
Browser tab
  ├─ HTTP mutations ──> Next route ──> RoomService ──> RoomStore (Redis / local memory)
  └─ WebSocket         ──> transport ──> RealtimeHub <── Redis Streams relay
                                           └─ room.updated events
```

## Identity

Each tab creates a random `playerId` and random credential in `sessionStorage`. The credential survives reloads in that tab, while another tab gets a different identity. The server stores only a SHA-256 hash of the credential inside the room record.

The client may display its player ID, but the server always authorizes mutations with the credential. A client cannot claim host status by changing a request body.

## Room state

Room records are the source of truth. A room has a six-digit code, game ID, host ID, players, lifecycle status, game state, revision, timestamps, and an expiry deadline. Redis keys use `miniplay:room:v1:<code>` and expire after 12 hours.

Redis mutations use `WATCH` + `MULTI/EXEC` with a bounded retry loop. Local development uses a clearly reported memory adapter only when `REDIS_URL` is absent; production rejects room mutations without Redis.

## Realtime

The WebSocket transport is intentionally thin. It accepts `room:subscribe`, validates the identity, and registers the socket with the local hub. HTTP mutations publish a `room.updated` event. The hub broadcasts locally and appends the event to a Redis Stream. Other function instances block on `XREAD` and forward new events to their local sockets. There is no tight Redis polling loop.

The local `server.ts` adapter uses the native `ws` package so `pnpm dev` can be tested with two browser tabs. The Vercel route uses `experimental_upgradeWebSocket` from `@vercel/functions`, following Vercel's current WebSocket Functions guidance. Vercel Functions pin a socket to one function instance, so Redis is required for cross-instance state and event delivery.

## Game boundary

`GameEngine` owns initial state, action validation, action application, result detection, and reset. `RoomService` only coordinates room lifecycle and delegates game rules to the registry entry. A new game adds a definition and an engine; the room manager and transport do not need game-specific branches.

Hidden-information games should implement viewer-specific `toPublicState` output before they are registered. Tic-Tac-Toe has no hidden information, so its state is safe to broadcast.
