"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { useFrame } from "@react-three/fiber";
import { useMetroStore } from "@/stores/useMetroStore";
import { computeAtmosphere } from "@/utils/atmosphere";
import type { BuildingItem } from "@/types/city";
import { applyFacadeShader, createFacadeUniforms } from "./facadeShader";

/** Base distance (m) beyond which building tiles are hidden. Scales up with
 * camera altitude so the city stays visible in zoomed-out overviews. */
const CULL_DIST = 19_000;
const CULL_DIST_MAX = 50_000;

const _tmp = new THREE.Color();

/** Shared facade uniforms (one Buildings instance per scene). */
const facadeUniforms = createFacadeUniforms();
function setNight(v: number) {
  facadeUniforms.uNight.value = v;
}

/** Stable pseudo-random in [0,1) from a building's centroid. */
function hash(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Facade color: taller towers trend cooler/lighter, low blocks warmer. */
function facadeColor(h: number, cx: number, cy: number): THREE.Color {
  const t = THREE.MathUtils.clamp(h / 90, 0, 1);
  const low = new THREE.Color("#b9b0a2"); // warm concrete
  const high = new THREE.Color("#aebccf"); // cool glass/steel
  _tmp.copy(low).lerp(high, t);
  const jitter = (hash(cx, cy) - 0.5) * 0.12;
  _tmp.offsetHSL(0, 0, jitter);
  return _tmp.clone();
}

function buildingColor(item: BuildingItem, cx: number, cy: number): THREE.Color {
  return facadeColor(item.h, cx, cy);
}

function centroid(r: number[]): [number, number] {
  let sx = 0;
  let sy = 0;
  const n = r.length / 2;
  for (let i = 0; i < r.length; i += 2) {
    sx += r[i];
    sy += r[i + 1];
  }
  return [sx / n, sy / n];
}

/** Extrude one footprint into a colored prism (z = 0..height). */
function extrude(item: BuildingItem): THREE.BufferGeometry | null {
  const n = item.r.length / 2;
  if (n < 3) return null;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < item.r.length; i += 2) {
    pts.push(new THREE.Vector2(item.r[i], item.r[i + 1]));
  }
  try {
    const shape = new THREE.Shape(pts);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: item.h,
      bevelEnabled: false,
      steps: 1,
    });
    geo.computeVertexNormals();
    const [cx, cy] = centroid(item.r);
    const col = buildingColor(item, cx, cy);
    const seed = hash(cx + 0.37, cy - 0.61);
    const vc = geo.attributes.position.count;
    const colors = new Float32Array(vc * 3);
    // Per-building (seed, height) consumed by the procedural facade shader.
    const info = new Float32Array(vc * 2);
    for (let i = 0; i < vc; i++) {
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      info[i * 2] = seed;
      info[i * 2 + 1] = item.h;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aBuilding", new THREE.BufferAttribute(info, 2));
    // ExtrudeGeometry emits UVs we never read; dropping them keeps the merged
    // tile buffers smaller.
    geo.deleteAttribute("uv");
    return geo;
  } catch {
    return null;
  }
}

interface Tile {
  key: string;
  geometry: THREE.BufferGeometry;
  center: THREE.Vector3;
}

/**
 * Buildings beyond the detail radius, baked as oriented boxes in one
 * InstancedMesh (single draw call for ~100k+ buildings).
 */
function FarBuildings({ boxes }: { boxes: number[] }) {
  const count = boxes.length / 6;

  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0, 0.5); // sit on the ground, scale z = height
    return g;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const setup = (inst: THREE.InstancedMesh | null) => {
    if (!inst) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const o = i * 6;
      const cx = boxes[o];
      const cy = boxes[o + 1];
      dummy.position.set(cx, cy, 0);
      dummy.rotation.set(0, 0, boxes[o + 2]);
      dummy.scale.set(boxes[o + 3], boxes[o + 4], boxes[o + 5]);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, facadeColor(boxes[o + 5], cx, cy));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  };

  if (count === 0) return null;

  return (
    <instancedMesh
      key={count}
      args={[geometry, undefined, count]}
      ref={setup}
      frustumCulled={false}
    >
      <meshStandardMaterial roughness={0.85} metalness={0.05} flatShading />
    </instancedMesh>
  );
}

/**
 * Extruded OSM buildings, merged per ~500 m tile into batched vertex-colored
 * meshes (few draw calls), with shadows, frustum culling, and distance culling.
 */
export default function Buildings() {
  const city = useMetroStore((s) => s.city);
  const visible = useMetroStore((s) => s.layers.buildings);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const tiles = useMemo<Tile[]>(() => {
    if (!city) return [];
    const size = city.buildings.tileSize;
    const out: Tile[] = [];
    for (const [key, items] of Object.entries(city.buildings.tiles)) {
      const geos: THREE.BufferGeometry[] = [];
      for (const item of items) {
        const g = extrude(item);
        if (g) geos.push(g);
      }
      if (geos.length === 0) continue;
      const merged = mergeBufferGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const [tx, ty] = key.split("_").map(Number);
      out.push({
        key,
        geometry: merged,
        center: new THREE.Vector3((tx + 0.5) * size, (ty + 0.5) * size, 0),
      });
    }
    return out;
  }, [city]);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.05,
      flatShading: true,
    });
    applyFacadeShader(m, facadeUniforms);
    return m;
  }, []);

  // Lit windows follow the time of day.
  const timeOfDay = useMetroStore((s) => s.timeOfDay);
  useEffect(() => {
    setNight(1 - computeAtmosphere(timeOfDay).day);
  }, [timeOfDay]);

  useEffect(() => {
    const geoms = tiles.map((t) => t.geometry);
    return () => {
      geoms.forEach((g) => g.dispose());
      material.dispose();
    };
  }, [tiles, material]);

  // Distance cull: hide tiles well beyond the fog so we don't draw the far city.
  useFrame(({ camera }) => {
    const refs = meshRefs.current;
    const cull = Math.min(
      Math.max(CULL_DIST, camera.position.z * 2.2),
      CULL_DIST_MAX
    );
    for (let i = 0; i < tiles.length; i++) {
      const m = refs[i];
      if (m) m.visible = camera.position.distanceTo(tiles[i].center) < cull;
    }
  });

  if (!city || !visible) return null;

  return (
    <group name="buildings">
      {tiles.map((t, i) => (
        <mesh
          key={t.key}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          geometry={t.geometry}
          material={material}
          castShadow
          receiveShadow
        />
      ))}
      <FarBuildings boxes={city.buildings.far ?? []} />
    </group>
  );
}
