# FPS Arena

FPS Arena (`fps-arena`) is the realtime game path in MiniPlay. The existing Room System remains the control plane: it creates and authorizes the room, tracks ready/start/rematch state, and stores the final result. It does not receive player transforms on every frame.

## Runtime architecture

- The room host is the browser-side simulation authority.
- WebSocket `/ws` (local) or `/api/ws` (Vercel adapter) is used only for authenticated WebRTC signaling. The server verifies the sender's room subscription and target membership before forwarding an offer, answer, or ICE candidate.
- Each peer has two DataChannels: `fps-unreliable` for input and snapshots, and `fps-reliable` for fire requests, combat events, resync, and pause notifications.
- Simulation runs at a fixed 30 Hz. Clients send input at about 20 Hz; the host sends snapshots at about 12.5 Hz. Remote players are interpolated in the render layer.
- The client predicts its own movement and applies host snapshots as reconciliation. The host validates input ranges, sequence order, movement through the same collision rules, fire cooldown, range, and hitscan visibility.

The host runs in a browser, so this is suitable for casual play rather than cheat-resistant competitive play. A modified host can still falsify the simulation.

## Map and rules

`Training Arena` is a 40×40 low-poly map built from primitive geometry. Player collision uses a radius/height approximation against the same AABB obstacle list used by the renderer. Assault Rifle hitscan uses 25 damage, 6 shots/second, 60-unit range, and unlimited ammunition. A player respawns after three seconds; the first player to 10 kills wins, otherwise the 180-second timer decides.

## NAT and failure behavior

The default configuration uses a public STUN server for development. Optional TURN settings are read from `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, and `NEXT_PUBLIC_TURN_CREDENTIAL`; credentials are not hardcoded. STUN cannot traverse every NAT, so some networks require a TURN relay. If the host connection disappears, the match stops with an explicit message; host migration is intentionally not implemented.

Background tabs can be throttled by the browser. The browser-side authority model therefore does not claim real-time guarantees while hidden or sleeping. A production competitive version would need a dedicated authoritative server.

## Verification status

- 3D rendering: implemented with Three.js, React Three Fiber, and low-poly primitives; production build passes.
- Local gameplay rules: verified by `tests/fps-arena.test.ts` for movement, jump, bounds/obstacles, hitscan occlusion, damage, fire rate, kill, respawn, countdown, and winner selection.
- WebRTC multiplayer: implemented with authenticated signaling and host-authoritative peer manager. A two-browser manual verification is still required in an environment with WebRTC/WebGL enabled.
- Production multiplayer: not claimed as verified here; Vercel/Upstash deployment and a real two-browser run need environment credentials and a deployed URL.

