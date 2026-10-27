import { describe, expect, it } from "vitest";
import { ARENA_LIMIT, isPositionClear, moveWithCollision } from "@/modules/game/implementations/fps-arena/engine/collision";
import { calculateDamage, findHitscanTarget } from "@/modules/game/implementations/fps-arena/engine/combat";
import { fpsArenaEngine } from "@/modules/game/implementations/fps-arena/engine/match-state";
import { FpsSimulation } from "@/modules/game/implementations/fps-arena/engine/simulation";
import { stepMovement } from "@/modules/game/implementations/fps-arena/engine/movement";
import { FPS_RULES } from "@/modules/game/implementations/fps-arena/engine/rules";

describe("FPS Arena movement and collision", () => {
  it("keeps the player inside the arena and resolves obstacle collisions", () => {
    expect(isPositionClear(-3, 0)).toBe(false);
    const next = moveWithCollision({ x: ARENA_LIMIT - 1, y: 0, z: 0 }, { x: ARENA_LIMIT + 3, y: 0, z: 0 });
    expect(next.x).toBe(ARENA_LIMIT - 1);
  });

  it("supports gravity and a constrained jump through the movement engine", () => {
    const grounded = { position: { x: 0, y: 0, z: 8 }, velocity: { x: 0, y: 0, z: 0 }, grounded: true };
    const jumped = stepMovement(grounded, { forward: 0, strafe: 0, sprint: false, jump: true, yaw: 0, pitch: 0, seq: 1 }, 1 / 30);
    expect(jumped.position.y).toBeGreaterThan(0);
    expect(jumped.velocity.y).toBeGreaterThan(0);
  });
});

describe("FPS Arena hitscan combat", () => {
  it("stops at a wall and applies rifle damage", () => {
    const clearHit = findHitscanTarget({ origin: { x: 0, y: 1.55, z: -6 }, direction: { x: 0, y: 0, z: -1 } }, "a", [{ id: "b", position: { x: 0, y: 0, z: -10 }, alive: true }]);
    expect(clearHit?.targetId).toBe("b");
    const blockedHit = findHitscanTarget({ origin: { x: 2, y: 1.55, z: 6 }, direction: { x: 0, y: 0, z: -1 } }, "a", [{ id: "b", position: { x: 2, y: 0, z: -6 }, alive: true }]);
    expect(blockedHit).toBeNull();
    expect(calculateDamage(100)).toBe(75);
    expect(calculateDamage(25)).toBe(0);
  });

  it("enforces fire rate, kill count and delayed respawn", () => {
    const simulation = new FpsSimulation([{ id: "player-a", nickname: "A" }, { id: "player-b", nickname: "B" }]);
    simulation.applySnapshot({ version: 1, sequence: 1, timestamp: 0, players: [
      { id: "player-a", position: { x: 0, y: 0, z: -6 }, velocity: { x: 0, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0 }, hp: 100, alive: true, kills: 0, deaths: 0, respawnAt: null },
      { id: "player-b", position: { x: 0, y: 0, z: -10 }, velocity: { x: 0, y: 0, z: 0 }, rotation: { yaw: Math.PI, pitch: 0 }, hp: 100, alive: true, kills: 0, deaths: 0, respawnAt: null },
    ] }, "nobody");
    expect(simulation.fire("player-a", { x: 0, y: 0, z: -1 }, 1_000, "shot-1")?.targetId).toBe("player-b");
    expect(simulation.fire("player-a", { x: 0, y: 0, z: -1 }, 1_050, "shot-2")).toBeNull();
    simulation.fire("player-a", { x: 0, y: 0, z: -1 }, 1_200, "shot-3");
    simulation.fire("player-a", { x: 0, y: 0, z: -1 }, 1_400, "shot-4");
    const kill = simulation.fire("player-a", { x: 0, y: 0, z: -1 }, 1_600, "shot-4");
    expect(kill?.killed).toBe(true);
    expect(simulation.getPlayer("player-a")?.kills).toBe(1);
    expect(simulation.getPlayer("player-b")?.alive).toBe(false);
    simulation.step("player-b", { forward: 0, strafe: 0, sprint: false, jump: false, yaw: 0, pitch: 0, seq: 1 }, 1 / 30, 4_601);
    expect(simulation.getPlayer("player-b")?.alive).toBe(true);
    expect(simulation.getPlayer("player-b")?.hp).toBe(FPS_RULES.maxHealth);
  });
});

describe("FPS Arena match lifecycle", () => {
  it("starts after connection countdown and resolves a winner", () => {
    const initial = fpsArenaEngine.createInitialState(["player-a", "player-b"], 1_000);
    const countdown = fpsArenaEngine.applyAction(initial, { type: "fps-begin-match", payload: {} }, "player-a", 1_000);
    expect(countdown.phase).toBe("COUNTDOWN");
    const playing = fpsArenaEngine.advance!(countdown, countdown.countdownEndsAt! + 1);
    expect(playing.phase).toBe("PLAYING");
    const finished = fpsArenaEngine.applyAction(playing, { type: "fps-finish-match", payload: { reason: "score", scores: { "player-a": { kills: 10, deaths: 0 }, "player-b": { kills: 2, deaths: 4 } } } }, "player-a", 5_000);
    expect(finished.phase).toBe("FINISHED");
    expect(finished.winnerIds).toEqual(["player-a"]);
    expect(fpsArenaEngine.getResult(finished).winnerId).toBe("player-a");
  });
});
