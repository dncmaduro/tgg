export const FPS_RULES = {
  matchDurationMs: 180_000,
  countdownMs: 3_000,
  maxScore: 10,
  maxHealth: 100,
  damage: 25,
  fireIntervalMs: 1_000 / 6,
  weaponRange: 60,
  walkSpeed: 4.5,
  sprintSpeed: 7,
  acceleration: 30,
  airAcceleration: 10,
  gravity: 22,
  jumpSpeed: 8,
  playerRadius: 0.35,
  playerHeight: 1.8,
  eyeHeight: 1.55,
  fixedStepMs: 1_000 / 30,
  inputIntervalMs: 50,
  snapshotIntervalMs: 80,
} as const;

export type FpsVector3 = { x: number; y: number; z: number };
export type FpsRotation = { yaw: number; pitch: number };

export type FpsInput = {
  forward: number;
  strafe: number;
  sprint: boolean;
  jump: boolean;
  yaw: number;
  pitch: number;
  seq: number;
};

export const ZERO_VECTOR: FpsVector3 = { x: 0, y: 0, z: 0 };

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

export function normalizeAngle(angle: number): number {
  const normalized = ((angle + Math.PI) % (Math.PI * 2)) - Math.PI;
  return normalized === -Math.PI ? Math.PI : normalized;
}

export function sanitizeInput(input: Partial<FpsInput>): FpsInput {
  return {
    forward: clampNumber(input.forward ?? 0, -1, 1),
    strafe: clampNumber(input.strafe ?? 0, -1, 1),
    sprint: input.sprint === true,
    jump: input.jump === true,
    yaw: normalizeAngle(clampNumber(input.yaw ?? 0, -Math.PI * 8, Math.PI * 8)),
    pitch: clampNumber(input.pitch ?? 0, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05),
    seq: Math.max(0, Math.floor(input.seq ?? 0)),
  };
}

export function directionFromRotation(rotation: FpsRotation): FpsVector3 {
  const cosPitch = Math.cos(rotation.pitch);
  return {
    x: Math.sin(rotation.yaw) * cosPitch,
    y: -Math.sin(rotation.pitch),
    z: -Math.cos(rotation.yaw) * cosPitch,
  };
}

export function distanceSquared(a: FpsVector3, b: FpsVector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}
