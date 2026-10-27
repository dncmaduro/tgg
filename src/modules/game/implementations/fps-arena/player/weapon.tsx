"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";

export function WeaponView({ muzzleFlash }: { muzzleFlash: boolean }) {
  const { camera } = useThree();
  const ref = useRef<Group>(null);
  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    camera.add(group);
    return () => { camera.remove(group); };
  }, [camera]);
  return <group ref={ref} position={[0.36, -0.31, -0.62]} rotation={[0, -0.05, -0.04]}>
    <mesh position={[0, 0, 0]}><boxGeometry args={[0.18, 0.18, 0.68]} /><meshStandardMaterial color="#20272b" roughness={0.65} /></mesh>
    <mesh position={[0, -0.18, 0.08]} rotation={[0.28, 0, 0]}><boxGeometry args={[0.16, 0.38, 0.18]} /><meshStandardMaterial color="#303b40" roughness={0.8} /></mesh>
    <mesh position={[0, 0.02, -0.44]}><boxGeometry args={[0.08, 0.08, 0.32]} /><meshStandardMaterial color="#11171a" /></mesh>
    {muzzleFlash && <mesh position={[0, 0.02, -0.65]}><coneGeometry args={[0.13, 0.28, 6]} /><meshBasicMaterial color="#f5c76b" /></mesh>}
  </group>;
}
