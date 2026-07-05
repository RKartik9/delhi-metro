"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useMetroStore } from "@/stores/useMetroStore";
import { layoutHeight } from "@/utils/lineCurve";

const _c = new THREE.Color();

/**
 * Simple 3D station structures: an elevated/at-grade platform deck at track
 * height, or a small ground-level entrance headhouse for underground stations.
 */
export default function StationStructures() {
  const data = useMetroStore((s) => s.data);
  const metroVisible = useMetroStore((s) => s.layers.metro);

  const built = useMemo(() => {
    if (!data) return null;
    const dummy = new THREE.Object3D();
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    for (const s of data.stations) {
      const [x, y] = s.position;
      const big = s.interchange;
      if (s.layout === "Underground") {
        const w = big ? 22 : 13;
        dummy.position.set(x, y, 4);
        dummy.scale.set(w, w, 8);
        cols.push(_c.clone().set(big ? "#c8b98f" : "#b7a98a"));
      } else {
        const h = layoutHeight(s.layout);
        const w = big ? 40 : 26;
        const deck = big ? 5 : 3.5;
        dummy.position.set(x, y, h);
        dummy.scale.set(w, big ? w : 16, deck);
        cols.push(_c.clone().set(big ? "#d7dce4" : "#c2c7d0"));
      }
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return { mats, cols };
  }, [data]);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  if (!data || !metroVisible || !built) return null;

  return (
    <instancedMesh
      args={[geometry, undefined, built.mats.length]}
      castShadow
      receiveShadow
      ref={(inst) => {
        if (!inst) return;
        built.mats.forEach((m, i) => {
          inst.setMatrixAt(i, m);
          inst.setColorAt(i, built.cols[i]);
        });
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      }}
    >
      <meshStandardMaterial roughness={0.85} metalness={0.05} />
    </instancedMesh>
  );
}
