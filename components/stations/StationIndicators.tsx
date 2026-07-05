"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMetroStore } from "@/stores/useMetroStore";

/**
 * Visual feedback for the hovered and selected station: a spinning hover halo
 * and a larger pulsing selection halo with a vertical beam.
 */
export default function StationIndicators() {
  const data = useMetroStore((s) => s.data);
  const hoveredId = useMetroStore((s) => s.hoveredStationId);
  const selectedId = useMetroStore((s) => s.selectedStationId);

  const hoverRef = useRef<THREE.Mesh>(null);
  const selRef = useRef<THREE.Mesh>(null);

  const hovered = hoveredId && data ? data.stationsById[hoveredId] : null;
  const selected = selectedId && data ? data.stationsById[selectedId] : null;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (hoverRef.current) hoverRef.current.rotation.z = t * 1.5;
    if (selRef.current) {
      selRef.current.rotation.z = -t;
      const s = 1 + 0.15 * Math.sin(t * 3);
      selRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group name="station-indicators">
      {hovered && (
        <mesh
          ref={hoverRef}
          position={[hovered.position[0], hovered.position[1], 20]}
        >
          <ringGeometry args={[22, 30, 32]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}

      {selected && (
        <group position={[selected.position[0], selected.position[1], 0]}>
          <mesh ref={selRef} position={[0, 0, 20]}>
            <ringGeometry args={[32, 46, 40]} />
            <meshBasicMaterial
              color="#7dd3fc"
              transparent
              opacity={0.95}
              side={THREE.DoubleSide}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
          {/* vertical beam (cylinder is Y-aligned by default; rotate to Z) */}
          <mesh position={[0, 0, 200]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3, 3, 400, 8]} />
            <meshBasicMaterial
              color="#7dd3fc"
              transparent
              opacity={0.35}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
