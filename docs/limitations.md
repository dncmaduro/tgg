# Known limits in Phase 1

- Only Tic-Tac-Toe 3×3 is playable. Other cards are metadata-only and cannot create rooms.
- The local process adapter is for development and test feedback only.
- Vercel WebSocket Functions and `experimental_upgradeWebSocket` are beta/experimental surface area; deploy verification must be done with the current Vercel CLI and runtime.
- Redis Stream history is used as an inter-instance relay. Room snapshots remain the source of truth, and stale rooms are removed by Redis TTL.
