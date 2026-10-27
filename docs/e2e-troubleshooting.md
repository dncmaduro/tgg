# Playwright E2E troubleshooting

The browser test is intentionally a real two-context flow. It creates a room, joins the same room from a second context, readies both players, starts Tic-Tac-Toe, plays a win, and requests a rematch. It does not mock WebSocket, skip assertions, or use fixed sleeps to hide synchronization problems.

## WebSocket observability

Run the test with protocol logging enabled:

```bash
MINIPLAY_E2E_WS_DEBUG=1 pnpm test:e2e
```

The test records the browser-side WebSocket lifecycle, sent frames, received frames, close events, socket errors, browser console errors, page errors, and the browser close code/reason. The same flag enables server-side logs for connection, received-frame, parsed-message, subscribe result, handler-error, and unregister events. The server is also started by Playwright with the production-shaped local adapter:

```text
MINIPLAY_ALLOW_MEMORY=true MINIPLAY_LOCAL_E2E=true pnpm start
```

The pair `MINIPLAY_ALLOW_MEMORY=true MINIPLAY_LOCAL_E2E=true` is only a local test switch. A deployed process must use Redis; Vercel rejects memory fallback even if `MINIPLAY_ALLOW_MEMORY` is accidentally present without the explicit local-test flag.

## Diagnosis recorded in this checkout

- The custom Node server must forward upgrade requests that are not `/ws` to Next's development upgrade handler. Without that forwarding, the page can remain unhydrated because Next's HMR WebSocket is intercepted.
- The local adapter uses an explicit `noServer`/`handleUpgrade` flow at `/ws`. Using Next's `/api/ws` App Router route on the local custom server lets Next's route handling collide with the native socket before application frames are delivered; `/api/ws` remains the Vercel-only endpoint.
- The browser URL builder preserves `window.location.host` and uses `/ws` locally, while deployed clients use `/api/ws`.
- Native Node `ws` clients complete the same create/join/ready/start/action/rematch flow and receive `room:subscribed` plus `room:updated` frames. The room service tests cover reconnect presence, host transfer, room isolation, credential spoofing, finished-game protection, and rematch authorization.

The earlier container failure was reproducible only when the local browser used `/api/ws`; moving the local adapter to `/ws` removes that Next route collision. The final production-shaped run passes the full flow (`1 passed`). Use the debug command above to distinguish a browser-received frame from a server-side room mutation when diagnosing future changes.
