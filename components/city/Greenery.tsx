"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { useMetroStore } from "@/stores/useMetroStore";
import type { PolyItem } from "@/types/city";

const GREEN_Z = 0.3;
const TREE_CAP = 3200;
const TREE_AREA_PER = 1400; // one tree per this many m^2 of park/forest

const KIND_COLOR: Record<string, string> = {
  park: "#3f6f39",
  forest: "#2f5730",
  grass: "#4c7c46",
  pitch: "#57894c",
  cemetery: "#4a6b45",
};

function ringToVec2(r: number[]): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < r.length; i += 2) pts.push(new THREE.Vector2(r[i], r[i + 1]));
  return pts;
}

function shoelaceArea(r: number[]): number {
  let a = 0;
  const n = r.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1];
  }
  return Math.abs(a) / 2;
}

function pointInRing(px: number, py: number, r: number[]): boolean {
  let inside = false;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = r[i * 2];
    const yi = r[i * 2 + 1];
    const xj = r[j * 2];
    const yj = r[j * 2 + 1];
    const hit =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function colorFor(item: PolyItem): THREE.Color {
  return new THREE.Color(KIND_COLOR[item.k ?? "grass"] ?? KIND_COLOR.grass);
}

/** Deterministic PRNG so tree scattering is pure + stable across renders. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One low-poly tree = foliage cone + trunk, merged (built once, instanced). */
function makeTreeGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.5, 0.7, 4, 6);
  trunk.rotateX(Math.PI / 2); // Y-up cylinder -> Z-up
  trunk.translate(0, 0, 2);
  const foliage = new THREE.ConeGeometry(3.2, 9, 7);
  foliage.rotateX(Math.PI / 2);
  foliage.translate(0, 0, 8.5);
  // Vertex colors: brown trunk, green foliage.
  const paint = (g: THREE.BufferGeometry, hex: string) => {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  };
  paint(trunk, "#5b4632");
  paint(foliage, "#356b34");
  return mergeBufferGeometries([trunk, foliage], false) ?? foliage;
}

/**
 * Parks, forests and grass polygons as flat tinted ground, plus instanced
 * low-poly trees scattered inside park/forest areas.
 */
export default function Greenery() {
  const city = useMetroStore((s) => s.city);
  const visible = useMetroStore((s) => s.layers.greenery);

  const groundGeo = useMemo(() => {
    if (!city) return null;
    const geos: THREE.BufferGeometry[] = [];
    for (const item of city.greenery) {
      if (item.r.length < 6) continue;
      try {
        const g = new THREE.ShapeGeometry(new THREE.Shape(ringToVec2(item.r)));
        const col = colorFor(item);
        const n = g.attributes.position.count;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          arr[i * 3] = col.r;
          arr[i * 3 + 1] = col.g;
          arr[i * 3 + 2] = col.b;
        }
        g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
        geos.push(g);
      } catch {
        /* skip malformed polygon */
      }
    }
    if (geos.length === 0) return null;
    const merged = mergeBufferGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    return merged;
  }, [city]);

  const treeGeo = useMemo(() => makeTreeGeometry(), []);

  const treeMatrices = useMemo(() => {
    if (!city) return [];
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (const item of city.greenery) {
      if (item.k !== "park" && item.k !== "forest") continue;
      if (item.r.length < 6) continue;
      const area = shoelaceArea(item.r);
      const target = Math.min(60, Math.floor(area / TREE_AREA_PER));
      if (target <= 0) continue;
      // bbox
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < item.r.length; i += 2) {
        minX = Math.min(minX, item.r[i]);
        maxX = Math.max(maxX, item.r[i]);
        minY = Math.min(minY, item.r[i + 1]);
        maxY = Math.max(maxY, item.r[i + 1]);
      }
      const rng = makeRng((minX * 73856093) ^ (minY * 19349663) ^ item.r.length);
      let placed = 0;
      let attempts = 0;
      while (placed < target && attempts < target * 8) {
        attempts++;
        const px = minX + rng() * (maxX - minX);
        const py = minY + rng() * (maxY - minY);
        if (!pointInRing(px, py, item.r)) continue;
        const s = 0.7 + rng() * 0.7;
        dummy.position.set(px, py, GREEN_Z);
        dummy.rotation.set(0, 0, rng() * Math.PI);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        mats.push(dummy.matrix.clone());
        placed++;
        if (mats.length >= TREE_CAP) break;
      }
      if (mats.length >= TREE_CAP) break;
    }
    return mats;
  }, [city]);

  useEffect(() => {
    return () => {
      groundGeo?.dispose();
      treeGeo.dispose();
    };
  }, [groundGeo, treeGeo]);

  if (!city || !visible) return null;

  return (
    <group name="greenery">
      {groundGeo && (
        <mesh geometry={groundGeo} position={[0, 0, GREEN_Z]} receiveShadow>
          <meshStandardMaterial vertexColors roughness={1} metalness={0} />
        </mesh>
      )}
      {treeMatrices.length > 0 && (
        <instancedMesh
          args={[treeGeo, undefined, treeMatrices.length]}
          castShadow
          ref={(inst) => {
            if (!inst) return;
            treeMatrices.forEach((m, i) => inst.setMatrixAt(i, m));
            inst.instanceMatrix.needsUpdate = true;
          }}
        >
          <meshStandardMaterial vertexColors roughness={0.9} metalness={0} />
        </instancedMesh>
      )}
    </group>
  );
}
