import { moveWithCollision } from "./collision";
import { FPS_RULES, clampNumber, type FpsInput, type FpsVector3 } from "./rules";

export type MovementState = {
  position: FpsVector3;
  velocity: FpsVector3;
  grounded: boolean;
};

function approach(current: number, target: number, amount: number): number {
  if (current < target) return Math.min(target, current + amount);
  return Math.max(target, current - amount);
}

export function stepMovement(state: MovementState, rawInput: FpsInput, dt: number): MovementState {
  const input = {
    forward: clampNumber(rawInput.forward, -1, 1),
    strafe: clampNumber(rawInput.strafe, -1, 1),
  };
  const length = Math.hypot(input.forward, input.strafe);
  if (length > 1) {
    input.forward /= length;
    input.strafe /= length;
  }

  const sinYaw = Math.sin(rawInput.yaw);
  const cosYaw = Math.cos(rawInput.yaw);
  const desiredX = (sinYaw * input.forward + cosYaw * input.strafe) * (rawInput.sprint ? FPS_RULES.sprintSpeed : FPS_RULES.walkSpeed);
  const desiredZ = (-cosYaw * input.forward + sinYaw * input.strafe) * (rawInput.sprint ? FPS_RULES.sprintSpeed : FPS_RULES.walkSpeed);
  const acceleration = state.grounded ? FPS_RULES.acceleration : FPS_RULES.airAcceleration;
  const nextVelocity = { ...state.velocity };
  nextVelocity.x = approach(nextVelocity.x, desiredX, acceleration * dt);
  nextVelocity.z = approach(nextVelocity.z, desiredZ, acceleration * dt);

  let grounded = state.grounded;
  if (grounded && rawInput.jump) {
    nextVelocity.y = FPS_RULES.jumpSpeed;
    grounded = false;
  } else {
    nextVelocity.y -= FPS_RULES.gravity * dt;
  }

  const unclamped = {
    x: state.position.x + nextVelocity.x * dt,
    y: state.position.y + nextVelocity.y * dt,
    z: state.position.z + nextVelocity.z * dt,
  };
  const position = moveWithCollision(state.position, unclamped);
  if (position.y <= 0) {
    position.y = 0;
    nextVelocity.y = 0;
    grounded = true;
  }

  return { position, velocity: nextVelocity, grounded };
}
