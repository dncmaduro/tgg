"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { directionFromRotation, FPS_RULES, type FpsInput, type FpsVector3 } from "../engine/rules";
import type { FpsSimulation } from "../engine/simulation";

export type FpsControllerApi = { requestPointerLock: () => void };

type Props = {
  active: boolean;
  simulation: FpsSimulation;
  localPlayerId: string;
  onFixedStep: (input: FpsInput, dt: number, now: number) => void;
  onFire: (direction: FpsVector3, now: number) => void;
  onLockedChange: (locked: boolean) => void;
  onScoreboardChange: (open: boolean) => void;
  apiRef: MutableRefObject<FpsControllerApi | null>;
};

export function FpsController({ active, simulation, localPlayerId, onFixedStep, onFire, onLockedChange, onScoreboardChange, apiRef }: Props) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef(simulation.getPlayer(localPlayerId)?.rotation.yaw ?? 0);
  const pitch = useRef(0);
  const jumpQueued = useRef(false);
  const lockedRef = useRef(false);
  const accumulator = useRef(0);
  const callbacks = useRef({ onFixedStep, onFire, onLockedChange, onScoreboardChange });
  useEffect(() => {
    callbacks.current = { onFixedStep, onFire, onLockedChange, onScoreboardChange };
  }, [onFixedStep, onFire, onLockedChange, onScoreboardChange]);
  const cameraRef = useRef(camera);

  useEffect(() => {
    const canvas = gl.domElement;
    const keydown = (event: KeyboardEvent) => {
      if (event.code === "Tab") {
        event.preventDefault();
        callbacks.current.onScoreboardChange(true);
        return;
      }
      if (event.code === "Space") jumpQueued.current = true;
      keys.current.add(event.code);
    };
    const keyup = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
      if (event.code === "Tab") callbacks.current.onScoreboardChange(false);
    };
    const mousemove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas || !active) return;
      yaw.current -= event.movementX * 0.0022;
      pitch.current = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch.current - event.movementY * 0.0022));
    };
    const mousedown = (event: MouseEvent) => {
      if (event.button !== 0 || document.pointerLockElement !== canvas || !active) return;
      callbacks.current.onFire(directionFromRotation({ yaw: yaw.current, pitch: pitch.current }), Date.now());
    };
    const pointerlockchange = () => {
      const locked = document.pointerLockElement === canvas;
      lockedRef.current = locked;
      callbacks.current.onLockedChange(locked);
    };
    const click = () => { if (active && document.pointerLockElement !== canvas) void canvas.requestPointerLock(); };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("mousemove", mousemove);
    window.addEventListener("mousedown", mousedown);
    document.addEventListener("pointerlockchange", pointerlockchange);
    canvas.addEventListener("click", click);
    apiRef.current = { requestPointerLock: () => void canvas.requestPointerLock() };
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("mousemove", mousemove);
      window.removeEventListener("mousedown", mousedown);
      document.removeEventListener("pointerlockchange", pointerlockchange);
      canvas.removeEventListener("click", click);
      apiRef.current = null;
    };
  }, [active, apiRef, gl.domElement]);

  useFrame((_, delta) => {
    if (!active || !lockedRef.current) return;
    accumulator.current += Math.min(delta, 0.1);
    if (accumulator.current > 0.25) accumulator.current = 0.25;
    let steps = 0;
    while (accumulator.current >= FPS_RULES.fixedStepMs / 1_000 && steps < 4) {
      const input: FpsInput = {
        forward: (keys.current.has("KeyW") ? 1 : 0) - (keys.current.has("KeyS") ? 1 : 0),
        strafe: (keys.current.has("KeyD") ? 1 : 0) - (keys.current.has("KeyA") ? 1 : 0),
        sprint: keys.current.has("ShiftLeft") || keys.current.has("ShiftRight"),
        jump: jumpQueued.current,
        yaw: yaw.current,
        pitch: pitch.current,
        seq: 0,
      };
      jumpQueued.current = false;
      callbacks.current.onFixedStep(input, FPS_RULES.fixedStepMs / 1_000, Date.now());
      accumulator.current -= FPS_RULES.fixedStepMs / 1_000;
      steps += 1;
    }
    const player = simulation.getPlayer(localPlayerId);
    if (!player) return;
    cameraRef.current.position.set(player.position.x, player.position.y + FPS_RULES.eyeHeight, player.position.z);
    cameraRef.current.rotation.order = "YXZ";
    cameraRef.current.rotation.set(player.rotation.pitch, player.rotation.yaw, 0);
  });

  return null;
}
