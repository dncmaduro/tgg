"use client";

import { ARENA_LIMIT, ARENA_OBSTACLES } from "../engine/collision";

function Box({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={position}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.85} metalness={0.05} /></mesh>;
}

export function ArenaMap() {
  return <>
    <color attach="background" args={["#1b2025"]} />
    <ambientLight intensity={1.5} />
    <directionalLight position={[8, 18, 8]} intensity={2.4} />
    <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#515b60" roughness={1} /></mesh>
    <gridHelper args={[40, 20, "#727d80", "#687174"]} position={[0, 0.01, 0]} />
    <Box position={[0, 1.25, -19.5]} size={[40, 2.5, 1]} color="#394247" />
    <Box position={[0, 1.25, 19.5]} size={[40, 2.5, 1]} color="#394247" />
    <Box position={[-19.5, 1.25, 0]} size={[1, 2.5, 40]} color="#394247" />
    <Box position={[19.5, 1.25, 0]} size={[1, 2.5, 40]} color="#394247" />
    {ARENA_OBSTACLES.map((obstacle) => <Box key={obstacle.id} position={[(obstacle.minX + obstacle.maxX) / 2, obstacle.height / 2, (obstacle.minZ + obstacle.maxZ) / 2]} size={[obstacle.maxX - obstacle.minX, obstacle.height, obstacle.maxZ - obstacle.minZ]} color={obstacle.height > 2 ? "#687276" : "#7b8586"} />)}
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[ARENA_LIMIT - 1.5, ARENA_LIMIT - 1.45, 48]} /><meshBasicMaterial color="#a8b2ad" /></mesh>
  </>;
}
