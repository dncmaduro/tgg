# Known limits in Phase 1

- Only Tic-Tac-Toe 3×3 is playable. Other cards are metadata-only and cannot create rooms.
- The local process adapter is for development and test feedback only.
- The Vercel `/api/ws` route uses Vercel's `upgradeWebSocket` helper; the local custom server uses native `ws` at `/ws` to avoid Next App Router upgrade collisions. Vercel's WebSocket support requires Fluid Compute; deploy verification must still be done with the current Vercel CLI/runtime because local `pnpm start` does not exercise Vercel's function lifecycle or multi-instance behavior.
- Redis Stream history is used as an inter-instance relay. Room snapshots remain the source of truth, and stale rooms are removed by Redis TTL.
- Create/join throttling is best-effort per Function instance. Public abuse protection should use Vercel Firewall/rate limiting; the app deliberately avoids Redis counters to preserve the Upstash Free command budget.
- A local two-browser E2E pass does not prove that two Vercel Function instances exchanged a Redis Stream event. That requires an externally controlled multi-instance test or production observability evidence.
- Playwright E2E diagnostics are available with `MINIPLAY_E2E_WS_DEBUG=1`; see [E2E troubleshooting](e2e-troubleshooting.md).
