"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { useMetroStore } from "@/stores/useMetroStore";
import { layoutHeight } from "@/utils/lineCurve";

const dummy = new THREE.Object3D();

const RING_Z = 1.6; // glow ring hovers just above the ground plane

/**
 * Renders all stations as two instanced meshes for performance:
 *  - glowing node spheres (interchanges are larger and white-cored)
 *  - pulsing glow rings on the ground, coloured by the station's primary line
 */
export default function StationMarkers() {
  const data = useMetroStore((s) => s.data);
  const selectStation = useMetroStore((s) => s.selectStation);
  const hoverStation = useMetroStore((s) => s.hoverStation);
  const nodesRef = useRef<THREE.InstancedMesh>(null);
  const ringsRef = useRef<THREE.InstancedMesh>(null);

  const items = useMemo(() => {
    if (!data) return [];
    return data.stations.map((s) => {
      const primary = s.lines[0];
      const lineColor = new THREE.Color(data.colors[primary] ?? "#8fb6ff");
      return {
        x: s.position[0],
        y: s.position[1],
        z: layoutHeight(s.layout) + 8,
        nodeColor: s.interchange ? new THREE.Color("#ffffff") : lineColor,
        ringColor: lineColor,
        scale: s.interchange ? 1.7 : 1.0,
        phase: Math.abs(s.position[0] * 0.13 + s.position[1] * 0.19) % (Math.PI * 2),
      };
    });
  }, [data]);

  const count = items.length;

  // Place instances + assign per-instance colours once per dataset.
  useEffect(() => {
    const nodes = nodesRef.current;
    const rings = ringsRef.current;
    if (!nodes || !rings || count === 0) return;

    items.forEach((it, i) => {
      dummy.rotation.set(0, 0, 0);

      dummy.position.set(it.x, it.y, it.z);
      dummy.scale.setScalar(it.scale);
      dummy.updateMatrix();
      nodes.setMatrixAt(i, dummy.matrix);
      nodes.setColorAt(i, it.nodeColor);

      dummy.position.set(it.x, it.y, RING_Z);
      dummy.updateMatrix();
      rings.setMatrixAt(i, dummy.matrix);
      rings.setColorAt(i, it.ringColor);
    });

    nodes.instanceMatrix.needsUpdate = true;
    rings.instanceMatrix.needsUpdate = true;
    if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;
    if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    nodes.computeBoundingSphere();
    rings.computeBoundingSphere();
  }, [items, count]);

  // Animate the ring pulse.
  useFrame(({ clock }) => {
    const rings = ringsRef.current;
    if (!rings || count === 0) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const it = items[i];
      const pulse = it.scale * (1 + 0.25 * Math.sin(t * 2 + it.phase));
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(it.x, it.y, RING_Z);
      dummy.scale.setScalar(pulse);
      dummy.updateMatrix();
      rings.setMatrixAt(i, dummy.matrix);
    }
    rings.instanceMatrix.needsUpdate = true;
  });

  const stationAt = (instanceId: number | undefined) => {
    if (instanceId == null || !data) return null;
    return data.stations[instanceId] ?? null;
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const s = stationAt(e.instanceId);
    if (!s) return;
    hoverStation(s.id);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    hoverStation(null);
    document.body.style.cursor = "auto";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const s = stationAt(e.instanceId);
    if (!s) return;
    selectStation(useMetroStore.getState().selectedStationId === s.id ? null : s.id);
  };

  if (count === 0) return null;

  return (
    <group name="station-markers">
      <instancedMesh
        ref={nodesRef}
        args={[undefined, undefined, count]}
        frustumCulled={false}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
      >
        <sphereGeometry args={[12, 16, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <instancedMesh
        ref={ringsRef}
        args={[undefined, undefined, count]}
        frustumCulled={false}
      >
        <ringGeometry args={[18, 26, 28]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}
