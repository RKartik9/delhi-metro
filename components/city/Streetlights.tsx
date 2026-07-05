"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMetroStore } from "@/stores/useMetroStore";
import { computeAtmosphere } from "@/utils/atmosphere";
import type { RoadItem } from "@/types/city";

const CAP = 1600;
const SPACING = 95; // meters between lamps
const POLE_H = 9;
const MAJOR = new Set(["motorway", "trunk", "primary", "secondary"]);

/** Instanced streetlights along major roads; lamps glow after dusk. */
export default function Streetlights() {
  const city = useMetroStore((s) => s.city);
  const roadsVisible = useMetroStore((s) => s.layers.roads);
  const timeOfDay = useMetroStore((s) => s.timeOfDay);
  const lampMat = useRef<THREE.MeshStandardMaterial | null>(null);

  const positions = useMemo(() => {
    if (!city) return [];
    const out: { x: number; y: number; nx: number; ny: number; side: number }[] = [];
    let side = 1;
    for (const r of city.roads as RoadItem[]) {
      if (!MAJOR.has(r.c)) continue;
      const n = r.p.length / 2;
      if (n < 2) continue;
      const edge = r.w * 0.5 + 1.5;
      let carry = 0;
      for (let i = 0; i < n - 1; i++) {
        const ax = r.p[i * 2];
        const ay = r.p[i * 2 + 1];
        const bx = r.p[(i + 1) * 2];
        const by = r.p[(i + 1) * 2 + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        let s = carry;
        while (s < len) {
          const f = s / len;
          side = -side;
          out.push({
            x: ax + dx * f + nx * edge * side,
            y: ay + dy * f + ny * edge * side,
            nx,
            ny,
            side,
          });
          if (out.length >= CAP) return out;
          s += SPACING;
        }
        carry = s - len;
      }
    }
    return out;
  }, [city]);

  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.35, 0.35, POLE_H, 6), []);
  const lampGeo = useMemo(() => new THREE.SphereGeometry(1.1, 8, 8), []);
  useEffect(() => {
    poleGeo.rotateX(Math.PI / 2); // Y-up -> Z-up
    return () => {
      poleGeo.dispose();
      lampGeo.dispose();
    };
  }, [poleGeo, lampGeo]);

  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    const poles: THREE.Matrix4[] = [];
    const lamps: THREE.Matrix4[] = [];
    for (const p of positions) {
      dummy.position.set(p.x, p.y, POLE_H / 2);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.push(dummy.matrix.clone());
      dummy.position.set(p.x, p.y, POLE_H);
      dummy.updateMatrix();
      lamps.push(dummy.matrix.clone());
    }
    return { poles, lamps };
  }, [positions]);

  // Lamps brighten at night, dim during the day.
  useFrame(() => {
    const mat = lampMat.current;
    if (!mat) return;
    const day = computeAtmosphere(timeOfDay).day;
    mat.emissiveIntensity = 0.15 + (1 - day) * 2.4;
  });

  if (!city || !roadsVisible || positions.length === 0) return null;

  return (
    <group name="streetlights">
      <instancedMesh
        args={[poleGeo, undefined, matrices.poles.length]}
        castShadow
        ref={(inst) => {
          if (!inst) return;
          matrices.poles.forEach((m, i) => inst.setMatrixAt(i, m));
          inst.instanceMatrix.needsUpdate = true;
        }}
      >
        <meshStandardMaterial color="#3a3f47" roughness={0.8} />
      </instancedMesh>
      <instancedMesh
        args={[lampGeo, undefined, matrices.lamps.length]}
        ref={(inst) => {
          if (!inst) return;
          matrices.lamps.forEach((m, i) => inst.setMatrixAt(i, m));
          inst.instanceMatrix.needsUpdate = true;
        }}
      >
        <meshStandardMaterial
          ref={lampMat}
          color="#fff2cc"
          emissive="#ffdd99"
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
