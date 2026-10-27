# MiniPlay

MiniPlay is a small multiplayer mini-game platform built with Next.js App Router, TypeScript, WebSockets, Redis, and browser game runtimes. It includes Tic-Tac-Toe (Caro mini), Nối từ, and FPS Arena.

## Quick start

Requirements: Node.js 20.9+, pnpm 9+, and (for shared production state) an Upstash Redis database.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`pnpm dev` runs a small Node WebSocket server around Next.js so two browser tabs can be used locally. If Redis is not configured, development uses an explicit in-memory adapter and the UI/API report that it is local-only; production refuses to start room mutations without Redis.

Open `http://localhost:3000` in two browser tabs. Use `sessionStorage`-backed identity so each tab behaves like a different player while reloads preserve the same player credentials.

## Commands

```bash
pnpm dev          # Next.js + native ws adapter
pnpm build        # production build
pnpm start        # production server + native ws adapter
pnpm typecheck    # strict TypeScript check
pnpm test         # Vitest unit/integration tests
pnpm test:e2e      # Playwright flow (starts a production-shaped local app)
```

See [docs/deployment.md](docs/deployment.md), [docs/architecture.md](docs/architecture.md), [docs/realtime-protocol.md](docs/realtime-protocol.md), and [docs/game-development.md](docs/game-development.md) for deployment, implementation details, and extension points.

FPS Arena implementation notes and verification boundaries are in [docs/fps-arena.md](docs/fps-arena.md).
