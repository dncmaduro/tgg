import { ARENA_OBSTACLES, type ArenaObstacle } from "./collision";
import { FPS_RULES, type FpsVector3 } from "./rules";

export type Ray = { origin: FpsVector3; direction: FpsVector3 };
export type HitTarget = { id: string; position: FpsVector3; alive: boolean };
export type CombatHit = { targetId: string; distance: number } | null;

function rayBoxDistance(ray: Ray, min: FpsVector3, max: FpsVector3): number | null {
  let near = 0;
  let far: number = FPS_RULES.weaponRange;
  for (const axis of ["x", "y", "z"] as const) {
    const origin = ray.origin[axis];
    const direction = ray.direction[axis];
    if (Math.abs(direction) < 1e-8) {
      if (origin < min[axis] || origin > max[axis]) return null;
      continue;
    }
    const a = (min[axis] - origin) / direction;
    const b = (max[axis] - origin) / direction;
    const nextNear = Math.min(a, b);
    const nextFar = Math.max(a, b);
    near = Math.max(near, nextNear);
    far = Math.min(far, nextFar);
    if (near > far) return null;
  }
  return near >= 0 && near <= FPS_RULES.weaponRange ? near : null;
}

function obstacleDistance(ray: Ray, obstacle: ArenaObstacle): number | null {
  return rayBoxDistance(ray, { x: obstacle.minX, y: 0, z: obstacle.minZ }, { x: obstacle.maxX, y: obstacle.height, z: obstacle.maxZ });
}

export function findHitscanTarget(ray: Ray, shooterId: string, targets: HitTarget[]): CombatHit {
  let nearestObstacle = Infinity;
  for (const obstacle of ARENA_OBSTACLES) {
    const distance = obstacleDistance(ray, obstacle);
    if (distance !== null) nearestObstacle = Math.min(nearestObstacle, distance);
  }

  let hit: CombatHit = null;
  for (const target of targets) {
    if (target.id === shooterId || !target.alive) continue;
    const distance = rayBoxDistance(
      ray,
      { x: target.position.x - FPS_RULES.playerRadius, y: target.position.y, z: target.position.z - FPS_RULES.playerRadius },
      { x: target.position.x + FPS_RULES.playerRadius, y: target.position.y + FPS_RULES.playerHeight, z: target.position.z + FPS_RULES.playerRadius },
    );
    if (distance === null || distance > nearestObstacle) continue;
    if (!hit || distance < hit.distance) hit = { targetId: target.id, distance };
  }
  return hit;
}

export function calculateDamage(currentHealth: number, damage = FPS_RULES.damage): number {
  return Math.max(0, Math.min(FPS_RULES.maxHealth, currentHealth) - Math.max(0, damage));
}
