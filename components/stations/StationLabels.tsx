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

/** Street view: labels shrink to signpost size and sit lower over the entrance. */
const STREET_SCALE = 0.04;
const STREET_LABEL_Z = 12;
const STREET_REVEAL_DIST = 600;
const STREET_INTERCHANGE_DIST = 1_800;

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
    const street = useMetroStore.getState().cameraMode === "street";
    const scale = street ? STREET_SCALE : 1;
    const z = street ? STREET_LABEL_Z : LABEL_Z;
    const far = street ? STREET_INTERCHANGE_DIST : INTERCHANGE_DIST;
    const near = street ? STREET_REVEAL_DIST : REVEAL_DIST;
    const arr = refs.current;
    for (let i = 0; i < arr.length; i++) {
      const o = arr[i];
      if (!o) continue;
      o.position.z = z;
      const d = camera.position.distanceTo(o.position);
      // Aerial labels are sized for the fly-to distance (~600 m); shrink them
      // when the camera gets closer (e.g. lifting off from street view).
      o.scale.setScalar(street ? scale : THREE.MathUtils.clamp(d / 600, 0.15, 1));
      const visible = stations[i].interchange ? d < far : d < near;
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
