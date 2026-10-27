"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";
import type { RuntimePlayer } from "../engine/simulation";

function colorForPlayer(id: string): string {
  const colors = ["#9ff3c7", "#f5c76b", "#9ac8ff", "#f59a9a", "#d4a5ff", "#f2a97b"];
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

export function RemotePlayer({ player }: { player: RuntimePlayer }) {
  const ref = useRef<Group>(null);
  const target = useRef(player);
  const color = colorForPlayer(player.id);

  useEffect(() => { target.current = player; }, [player]);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const next = target.current;
    const blend = Math.min(1, delta * 14);
    ref.current.position.x += (next.position.x - ref.current.position.x) * blend;
    ref.current.position.y += (next.position.y - ref.current.position.y) * blend;
    ref.current.position.z += (next.position.z - ref.current.position.z) * blend;
    ref.current.rotation.y += (next.rotation.yaw - ref.current.rotation.y) * blend;
  });

  return <group ref={ref} position={[player.position.x, player.position.y, player.position.z]}>
    <Html position={[0, 2.35, 0]} center distanceFactor={11} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
      <span style={{ color: "#f4f4f5", background: "rgba(15,17,21,.78)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 4, padding: "2px 5px", fontSize: 10 }}>{player.nickname}</span>
    </Html>
    <group visible={player.alive}>
      <mesh position={[0, 1.12, 0]}><boxGeometry args={[0.58, 0.82, 0.38]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>
      <mesh position={[0, 1.75, 0]}><icosahedronGeometry args={[0.31, 1]} /><meshStandardMaterial color="#d9c4ad" roughness={0.9} /></mesh>
      <mesh position={[-0.42, 1.1, 0]} rotation={[0, 0, 0.14]}><boxGeometry args={[0.16, 0.7, 0.16]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0.42, 1.1, 0]} rotation={[0, 0, -0.14]}><boxGeometry args={[0.16, 0.7, 0.16]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[-0.17, 0.43, 0]}><boxGeometry args={[0.18, 0.72, 0.2]} /><meshStandardMaterial color="#263138" /></mesh>
      <mesh position={[0.17, 0.43, 0]}><boxGeometry args={[0.18, 0.72, 0.2]} /><meshStandardMaterial color="#263138" /></mesh>
      <mesh position={[0.28, 1.08, -0.34]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.12, 0.56, 0.12]} /><meshStandardMaterial color="#222a2f" /></mesh>
    </group>
  </group>;
}
