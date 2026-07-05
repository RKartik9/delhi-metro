"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useMetroStore } from "@/stores/useMetroStore";
import type { RoadItem } from "@/types/city";

const ROAD_Z = 0.9;

const ROAD_COLOR: Record<string, string> = {
  motorway: "#565b64",
  trunk: "#53575f",
  primary: "#4f535b",
  secondary: "#4b4f57",
  tertiary: "#484c53",
  residential: "#43464d",
  unclassified: "#43464d",
  living_street: "#41444a",
  motorway_link: "#565b64",
  trunk_link: "#53575f",
  primary_link: "#4f535b",
  secondary_link: "#4b4f57",
};

function colorFor(cls: string): THREE.Color {
  return new THREE.Color(ROAD_COLOR[cls] ?? "#44474e");
}

/** Build one merged ribbon geometry (vertex-colored) for all roads. */
function buildGeometry(roads: RoadItem[]): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const colors: number[] = [];
  const tmp = new THREE.Color();

  for (const road of roads) {
    const p = road.p;
    const n = p.length / 2;
    if (n < 2) continue;
    const hw = road.w / 2;
    tmp.copy(colorFor(road.c));

    for (let i = 0; i < n - 1; i++) {
      const ax = p[i * 2];
      const ay = p[i * 2 + 1];
      const bx = p[(i + 1) * 2];
      const by = p[(i + 1) * 2 + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * hw;
      const ny = (dx / len) * hw;

      // Two triangles: (a+,a-,b-) and (a+,b-,b+)
      const a0x = ax + nx;
      const a0y = ay + ny;
      const a1x = ax - nx;
      const a1y = ay - ny;
      const b0x = bx + nx;
      const b0y = by + ny;
      const b1x = bx - nx;
      const b1y = by - ny;

      positions.push(
        a0x, a0y, ROAD_Z, a1x, a1y, ROAD_Z, b1x, b1y, ROAD_Z,
        a0x, a0y, ROAD_Z, b1x, b1y, ROAD_Z, b0x, b0y, ROAD_Z
      );
      for (let k = 0; k < 6; k++) colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/** OSM roads as flat batched ribbons, width/color by highway class. */
export default function Roads() {
  const city = useMetroStore((s) => s.city);
  const visible = useMetroStore((s) => s.layers.roads);

  const geometry = useMemo(() => (city ? buildGeometry(city.roads) : null), [city]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!city || !visible || !geometry) return null;

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.95}
        metalness={0}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}
