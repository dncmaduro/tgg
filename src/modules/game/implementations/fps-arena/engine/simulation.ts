import { clampSpawn, isPositionClear } from "./collision";
import { calculateDamage, findHitscanTarget } from "./combat";
import { stepMovement, type MovementState } from "./movement";
import { FPS_RULES, sanitizeInput, type FpsInput, type FpsRotation, type FpsVector3 } from "./rules";
import { getSpawnPoint } from "../world/spawn-points";

export type RuntimePlayer = MovementState & {
  id: string;
  nickname: string;
  rotation: FpsRotation;
  hp: number;
  alive: boolean;
  kills: number;
  deaths: number;
  respawnAt: number | null;
};

export type RuntimeCombatEvent = {
  eventId: string;
  shooterId: string;
  targetId: string | null;
  damage: number;
  remainingHealth: number | null;
  killed: boolean;
  timestamp: number;
};

export type RuntimeSnapshot = {
  version: 1;
  sequence: number;
  timestamp: number;
  players: Array<{
    id: string;
    position: FpsVector3;
    velocity: FpsVector3;
    rotation: FpsRotation;
    hp: number;
    alive: boolean;
    kills: number;
    deaths: number;
    respawnAt: number | null;
  }>;
};

function cloneVector(value: FpsVector3): FpsVector3 {
  return { x: value.x, y: value.y, z: value.z };
}

function clonePlayer(player: RuntimePlayer): RuntimePlayer {
  return {
    ...player,
    position: cloneVector(player.position),
    velocity: cloneVector(player.velocity),
    rotation: { ...player.rotation },
  };
}

export class FpsSimulation {
  private readonly players = new Map<string, RuntimePlayer>();
  private readonly lastFireAt = new Map<string, number>();
  private lastSnapshotSequence = 0;

  constructor(playerList: Array<{ id: string; nickname: string }>) {
    playerList.forEach((player, index) => {
      const position = clampSpawn(getSpawnPoint(index));
      this.players.set(player.id, {
        id: player.id,
        nickname: player.nickname,
        position,
        velocity: { x: 0, y: 0, z: 0 },
        grounded: true,
        rotation: { yaw: index % 2 === 0 ? 0 : Math.PI, pitch: 0 },
        hp: FPS_RULES.maxHealth,
        alive: true,
        kills: 0,
        deaths: 0,
        respawnAt: null,
      });
    });
  }

  getPlayer(id: string): RuntimePlayer | undefined {
    const player = this.players.get(id);
    return player ? clonePlayer(player) : undefined;
  }

  getPlayers(): RuntimePlayer[] {
    return [...this.players.values()].map(clonePlayer);
  }

  setLook(id: string, input: FpsInput): void {
    const player = this.players.get(id);
    if (!player) return;
    const clean = sanitizeInput(input);
    player.rotation = { yaw: clean.yaw, pitch: clean.pitch };
  }

  step(id: string, input: FpsInput, dt: number, now: number): void {
    const player = this.players.get(id);
    if (!player) return;
    if (!player.alive) {
      if (player.respawnAt !== null && now >= player.respawnAt) this.respawn(id);
      return;
    }
    const clean = sanitizeInput(input);
    player.rotation = { yaw: clean.yaw, pitch: clean.pitch };
    const next = stepMovement(player, clean, Math.min(0.1, Math.max(0, dt)));
    player.position = next.position;
    player.velocity = next.velocity;
    player.grounded = next.grounded;
  }

  fire(shooterId: string, direction: FpsVector3, now: number, eventId: string): RuntimeCombatEvent | null {
    const shooter = this.players.get(shooterId);
    if (!shooter || !shooter.alive) return null;
    const previousFire = this.lastFireAt.get(shooterId) ?? -Infinity;
    if (now - previousFire < FPS_RULES.fireIntervalMs * 0.9) return null;
    this.lastFireAt.set(shooterId, now);
    const length = Math.hypot(direction.x, direction.y, direction.z);
    if (!Number.isFinite(length) || length < 0.1) return null;
    const ray = {
      origin: { x: shooter.position.x, y: shooter.position.y + FPS_RULES.eyeHeight, z: shooter.position.z },
      direction: { x: direction.x / length, y: direction.y / length, z: direction.z / length },
    };
    const target = findHitscanTarget(ray, shooterId, this.getPlayers());
    if (!target) return { eventId, shooterId, targetId: null, damage: 0, remainingHealth: null, killed: false, timestamp: now };
    const victim = this.players.get(target.targetId);
    if (!victim) return null;
    victim.hp = calculateDamage(victim.hp);
    const killed = victim.hp <= 0;
    if (killed) {
      victim.alive = false;
      victim.deaths += 1;
      victim.respawnAt = now + 3_000;
      shooter.kills += 1;
    }
    return { eventId, shooterId, targetId: victim.id, damage: FPS_RULES.damage, remainingHealth: victim.hp, killed, timestamp: now };
  }

  respawn(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    const spawn = getSpawnPoint((player.deaths + [...this.players.keys()].indexOf(id)) % 6);
    player.position = isPositionClear(spawn.x, spawn.z) ? spawn : { x: 0, y: 0, z: 14 };
    player.velocity = { x: 0, y: 0, z: 0 };
    player.grounded = true;
    player.hp = FPS_RULES.maxHealth;
    player.alive = true;
    player.respawnAt = null;
  }

  getScores(): Record<string, { kills: number; deaths: number }> {
    return Object.fromEntries([...this.players.values()].map((player) => [player.id, { kills: player.kills, deaths: player.deaths }]));
  }

  hasWinner(): boolean {
    return [...this.players.values()].some((player) => player.kills >= FPS_RULES.maxScore);
  }

  toSnapshot(sequence: number, timestamp: number): RuntimeSnapshot {
    return {
      version: 1,
      sequence,
      timestamp,
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        position: cloneVector(player.position),
        velocity: cloneVector(player.velocity),
        rotation: { ...player.rotation },
        hp: player.hp,
        alive: player.alive,
        kills: player.kills,
        deaths: player.deaths,
        respawnAt: player.respawnAt,
      })),
    };
  }

  applySnapshot(snapshot: RuntimeSnapshot, localPlayerId: string): boolean {
    if (snapshot.version !== 1 || snapshot.sequence <= this.lastSnapshotSequence) return false;
    this.lastSnapshotSequence = snapshot.sequence;
    for (const incoming of snapshot.players) {
      const player = this.players.get(incoming.id);
      if (!player) continue;
      const correction = incoming.id === localPlayerId ? 0.35 : 1;
      player.position.x += (incoming.position.x - player.position.x) * correction;
      player.position.y += (incoming.position.y - player.position.y) * correction;
      player.position.z += (incoming.position.z - player.position.z) * correction;
      player.velocity = cloneVector(incoming.velocity);
      player.rotation = { ...incoming.rotation };
      player.hp = incoming.hp;
      player.alive = incoming.alive;
      player.kills = incoming.kills;
      player.deaths = incoming.deaths;
      player.respawnAt = incoming.respawnAt;
    }
    return true;
  }
}
