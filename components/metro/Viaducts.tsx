"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useMetroStore } from "@/stores/useMetroStore";
import { getLineCurve, ELEVATED_THRESHOLD } from "@/utils/lineCurve";

/** Spacing between viaduct pillars along an elevated section (meters). */
const PILLAR_SPACING = 70;
const PILLAR_SIZE = 2.6;

/**
 * Support pillars beneath elevated metro sections. Samples every line curve and
 * drops a pillar from the ground up to the deck wherever the track rides high.
 */
export default function Viaducts() {
  const data = useMetroStore((s) => s.data);
  const hiddenLineIds = useMetroStore((s) => s.hiddenLineIds);
  const metroVisible = useMetroStore((s) => s.layers.metro);

  const matrices = useMemo(() => {
    if (!data) return [];
    const dummy = new THREE.Object3D();
    const out: THREE.Matrix4[] = [];
    data.lines.forEach((line, index) => {
      if (hiddenLineIds.has(line.id)) return;
      const curve = getLineCurve(line, data, index);
      const len = curve.getLength();
      const steps = Math.max(2, Math.floor(len / PILLAR_SPACING));
      for (let i = 1; i < steps; i++) {
        const p = curve.getPointAt(i / steps);
        if (p.z < ELEVATED_THRESHOLD) continue;
        dummy.position.set(p.x, p.y, p.z / 2);
        dummy.scale.set(PILLAR_SIZE, PILLAR_SIZE, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        out.push(dummy.matrix.clone());
      }
    });
    return out;
  }, [data, hiddenLineIds]);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  if (!data || !metroVisible || matrices.length === 0) return null;

  return (
    <instancedMesh
      args={[geometry, undefined, matrices.length]}
      castShadow
      receiveShadow
      ref={(inst) => {
        if (!inst) return;
        matrices.forEach((m, i) => inst.setMatrixAt(i, m));
        inst.instanceMatrix.needsUpdate = true;
      }}
    >
      <meshStandardMaterial color="#8a8f98" roughness={0.9} metalness={0.05} />
    </instancedMesh>
  );
}
