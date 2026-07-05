"use client";

import { useMemo } from "react";
import { Text } from "@react-three/drei";
import { project } from "@/utils/geo";
import { useMetroStore } from "@/stores/useMetroStore";
import type { Position } from "@/types/metro";

type LandmarkKind = "arch" | "palace" | "colonnade" | "obelisk";

interface Landmark {
  name: string;
  at: Position; // [lng, lat]
  kind: LandmarkKind;
}

// A few notable central-Delhi landmarks that fall within the core radius.
const LANDMARKS: Landmark[] = [
  { name: "India Gate", at: [77.2295, 28.6129], kind: "arch" },
  { name: "Rashtrapati Bhavan", at: [77.1995, 28.6143], kind: "palace" },
  { name: "Parliament House", at: [77.2089, 28.6172], kind: "colonnade" },
  { name: "Jantar Mantar", at: [77.2166, 28.6271], kind: "obelisk" },
];

const STONE = "#d9c9a8";
const SANDSTONE = "#b6613b";

function LandmarkModel({ kind }: { kind: LandmarkKind }) {
  switch (kind) {
    case "arch":
      return (
        <group>
          <mesh position={[-9, 0, 21]} castShadow>
            <boxGeometry args={[6, 6, 42]} />
            <meshStandardMaterial color={STONE} roughness={0.9} />
          </mesh>
          <mesh position={[9, 0, 21]} castShadow>
            <boxGeometry args={[6, 6, 42]} />
            <meshStandardMaterial color={STONE} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 45]} castShadow>
            <boxGeometry args={[28, 8, 8]} />
            <meshStandardMaterial color={STONE} roughness={0.9} />
          </mesh>
        </group>
      );
    case "palace":
      return (
        <group>
          <mesh position={[0, 0, 12]} castShadow receiveShadow>
            <boxGeometry args={[90, 60, 24]} />
            <meshStandardMaterial color={SANDSTONE} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0, 30]} castShadow>
            <cylinderGeometry args={[16, 18, 12, 24]} />
            <meshStandardMaterial color={SANDSTONE} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 42]} castShadow>
            <sphereGeometry args={[16, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#8a4a2c" roughness={0.7} metalness={0.15} />
          </mesh>
        </group>
      );
    case "colonnade":
      return (
        <group>
          <mesh position={[0, 0, 2]} receiveShadow castShadow>
            <cylinderGeometry args={[86, 86, 4, 40]} />
            <meshStandardMaterial color={STONE} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 16]} castShadow>
            <cylinderGeometry args={[80, 80, 24, 40, 1, true]} />
            <meshStandardMaterial color={STONE} roughness={0.9} side={2} />
          </mesh>
        </group>
      );
    case "obelisk":
    default:
      return (
        <mesh position={[0, 0, 15]} castShadow>
          <coneGeometry args={[12, 30, 4]} />
          <meshStandardMaterial color={SANDSTONE} roughness={0.85} />
        </mesh>
      );
  }
}

/** Procedural stand-ins for notable landmarks, placed at their real locations. */
export default function Landmarks() {
  const buildingsVisible = useMetroStore((s) => s.layers.buildings);

  const placed = useMemo(
    () =>
      LANDMARKS.map((l) => {
        const [x, y] = project(l.at[0], l.at[1]);
        return { ...l, x, y };
      }),
    []
  );

  if (!buildingsVisible) return null;

  return (
    <group name="landmarks">
      {placed.map((l) => (
        <group key={l.name} position={[l.x, l.y, 0]}>
          <LandmarkModel kind={l.kind} />
          <Text
            position={[0, 0, 66]}
            fontSize={70}
            color="#fef3d6"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={5}
            outlineColor="#2a1c0c"
            outlineOpacity={0.85}
          >
            {l.name}
          </Text>
        </group>
      ))}
    </group>
  );
}
