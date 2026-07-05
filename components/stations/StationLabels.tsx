"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useMetroStore } from "@/stores/useMetroStore";

const LABEL_Z = 40;
/** Non-interchange labels appear only when the camera is within this distance (meters). */
const REVEAL_DIST = 2_600;
/** Interchange labels stay visible until the camera is very far out (meters). */
const INTERCHANGE_DIST = 14_000;

/**
 * Station name labels that always face the camera and reveal based on distance
 * (interchanges are visible from far; local stations appear as you zoom in),
 * which keeps the city-scale view readable and avoids label spam.
 */
export default function StationLabels() {
  const data = useMetroStore((s) => s.data);
  const refs = useRef<(THREE.Object3D | null)[]>([]);
  const { camera } = useThree();

  const stations = data?.stations;

  useFrame(() => {
    if (!stations) return;
    const arr = refs.current;
    for (let i = 0; i < arr.length; i++) {
      const o = arr[i];
      if (!o) continue;
      const d = camera.position.distanceTo(o.position);
      const visible = stations[i].interchange
        ? d < INTERCHANGE_DIST
        : d < REVEAL_DIST;
      o.visible = visible;
      if (visible) o.quaternion.copy(camera.quaternion);
    }
  });

  if (!stations) return null;

  return (
    <group name="station-labels">
      {stations.map((s, i) => (
        <Text
          key={s.id}
          ref={(el) => {
            refs.current[i] = el as unknown as THREE.Object3D | null;
          }}
          position={[s.position[0], s.position[1], LABEL_Z]}
          fontSize={s.interchange ? 140 : 80}
          color={s.interchange ? "#ffffff" : "#cdd8ee"}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={6}
          outlineColor="#05070d"
          outlineOpacity={0.9}
          visible={false}
        >
          {s.name}
        </Text>
      ))}
    </group>
  );
}
