import type { FpsVector3 } from "../engine/rules";

export const FPS_SPAWN_POINTS: FpsVector3[] = [
  { x: -16, y: 0, z: -16 },
  { x: 16, y: 0, z: 16 },
  { x: -16, y: 0, z: 14 },
  { x: 16, y: 0, z: -14 },
  { x: -6, y: 0, z: 16 },
  { x: 6, y: 0, z: -16 },
];

export function getSpawnPoint(index: number): FpsVector3 {
  const spawn = FPS_SPAWN_POINTS[index % FPS_SPAWN_POINTS.length];
  return { ...spawn };
}
