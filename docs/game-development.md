# Adding a game

1. Create `src/modules/game/implementations/<game>/engine.ts`.
2. Implement the `GameEngine` contract:
   - `createInitialState(playerIds)`
   - `applyAction(state, action, playerId)`
   - `getResult(state)`
   - `reset(playerIds)`
   - `toPublicState(state, viewerId)`
   - optionally `advance(state, now)` for server-verified deadline-based state
     transitions and `onPlayerLeave(state, playerId, now)` for game-specific
     elimination rules.
3. Validate every action inside the engine. Never trust coordinates, turn order, or win state from the browser.
4. Add a `GameDefinition` to `src/modules/game/registry/index.ts`.
5. Add unit tests for valid/invalid actions, win/draw, and reset.
6. If the game has hidden information, return only viewer-safe state from `toPublicState` and add tests proving that private state is not broadcast.

The engine should remain framework-free. React components render the public state and call the room action API; they must not mutate game state directly.
