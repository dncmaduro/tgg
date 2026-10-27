import { FPS_RULES, type FpsVector3 } from "./rules";

export type ArenaObstacle = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
};

export const ARENA_LIMIT = 18.5;

export const ARENA_OBSTACLES: ArenaObstacle[] = [
  { id: "block-west", minX: -14, maxX: -9, minZ: -12, maxZ: -7, height: 2.4 },
  { id: "block-east", minX: 9, maxX: 14, minZ: 7, maxZ: 12, height: 2.4 },
  { id: "center-west", minX: -5.5, maxX: -1.5, minZ: -3, maxZ: 3, height: 2.1 },
  { id: "center-east", minX: 1.5, maxX: 5.5, minZ: -3, maxZ: 3, height: 2.1 },
  { id: "crate-north", minX: -13, maxX: -9, minZ: 6, maxZ: 9, height: 1.5 },
  { id: "crate-south", minX: 9, maxX: 13, minZ: -9, maxZ: -6, height: 1.5 },
  { id: "lane-west", minX: -17, maxX: -14.5, minZ: -3, maxZ: 5, height: 2.8 },
  { id: "lane-east", minX: 14.5, maxX: 17, minZ: -5, maxZ: 3, height: 2.8 },
];

function overlapsBox(x: number, z: number, radius: number, obstacle: ArenaObstacle): boolean {
  return x + radius > obstacle.minX && x - radius < obstacle.maxX && z + radius > obstacle.minZ && z - radius < obstacle.maxZ;
}

export function isPositionClear(x: number, z: number, radius = FPS_RULES.playerRadius): boolean {
  if (x - radius < -ARENA_LIMIT || x + radius > ARENA_LIMIT || z - radius < -ARENA_LIMIT || z + radius > ARENA_LIMIT) return false;
  return !ARENA_OBSTACLES.some((obstacle) => overlapsBox(x, z, radius, obstacle));
}

export function moveWithCollision(position: FpsVector3, next: FpsVector3, radius = FPS_RULES.playerRadius): FpsVector3 {
  let x = next.x;
  let z = position.z;
  if (!isPositionClear(x, z, radius)) x = position.x;
  z = next.z;
  if (!isPositionClear(x, z, radius)) z = position.z;
  return { x, y: next.y, z };
}

export function clampSpawn(position: FpsVector3): FpsVector3 {
  if (isPositionClear(position.x, position.z)) return { ...position, y: 0 };
  return { x: 0, y: 0, z: 14 };
}
