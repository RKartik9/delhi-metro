"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useMetroStore } from "@/stores/useMetroStore";
import { DETAIL_RADIUS_M } from "@/utils/streetSpawn";
import type { RoadItem } from "@/types/city";

const ROAD_Z = 0.9;
/** Pavement ribbon sits just under the road surface so the road wins depth. */
const SIDEWALK_Z = 0.75;
/** Extra width (m) of the sidewalk ribbon on each side of the carriageway. */
const SIDEWALK_EACH = 2.5;
const SIDEWALK_COLOR = "#7d7f84";

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

const MAJOR = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "motorway_link",
  "trunk_link",
  "primary_link",
]);

function colorFor(cls: string): THREE.Color {
  return new THREE.Color(ROAD_COLOR[cls] ?? "#44474e");
}

interface RibbonOptions {
  z: number;
  /** Extra half-width added to every road. */
  pad: number;
  /** Fixed colour (sidewalks) or per-class (roads). */
  color?: THREE.Color;
  /** Only roads whose first vertex lies within this radius of the origin. */
  maxRadius?: number;
  /** Emit aRoad / aRoadInfo attributes for the marking shader. */
  markings?: boolean;
}

/** Build one merged ribbon geometry (vertex-colored) for all roads. */
function buildGeometry(roads: RoadItem[], opt: RibbonOptions): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const colors: number[] = [];
  const road: number[] = []; // (along, lat)
  const info: number[] = []; // (halfWidth, major)
  const tmp = new THREE.Color();
  const maxR2 = opt.maxRadius ? opt.maxRadius * opt.maxRadius : Infinity;

  for (const r of roads) {
    const p = r.p;
    const n = p.length / 2;
    if (n < 2) continue;
    if (p[0] * p[0] + p[1] * p[1] > maxR2) continue;
    const hw = r.w / 2 + opt.pad;
    tmp.copy(opt.color ?? colorFor(r.c));
    const major = MAJOR.has(r.c) ? 1 : 0;
    let along = 0;

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
      const a0 = along;
      const a1 = along + len;
      along = a1;

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
        a0x, a0y, opt.z, a1x, a1y, opt.z, b1x, b1y, opt.z,
        a0x, a0y, opt.z, b1x, b1y, opt.z, b0x, b0y, opt.z
      );
      for (let k = 0; k < 6; k++) colors.push(tmp.r, tmp.g, tmp.b);
      if (opt.markings) {
        road.push(a0, 1, a0, -1, a1, -1, a0, 1, a1, -1, a1, 1);
        for (let k = 0; k < 6; k++) info.push(hw, major);
      }
    }
  }

  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  if (opt.markings) {
    geo.setAttribute("aRoad", new THREE.Float32BufferAttribute(road, 2));
    geo.setAttribute("aRoadInfo", new THREE.Float32BufferAttribute(info, 2));
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Lane markings + asphalt grain, injected into the road material. Dashed
 * centre line on roads wider than 6 m, solid edge lines on major roads, all
 * fwidth-anti-aliased and faded out beyond a few hundred metres so the aerial
 * view is unchanged.
 */
function applyMarkingShader(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec2 aRoad;
attribute vec2 aRoadInfo;
varying vec2 vRoad;
varying vec2 vRoadInfo;
varying vec2 vRoadXY;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vRoad = aRoad;
vRoadInfo = aRoadInfo;
vRoadXY = position.xy;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vRoad;
varying vec2 vRoadInfo;
varying vec2 vRoadXY;
float roadHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  float viewDist = length(vViewPosition);
  float detail = 1.0 - smoothstep(350.0, 1000.0, viewDist);
  if (detail > 0.001) {
    float hw = vRoadInfo.x;
    float major = vRoadInfo.y;
    float lateral = vRoad.y * hw;              // metres from the centreline
    float along = vRoad.x;

    // Asphalt grain.
    float grain = roadHash(floor(vRoadXY * 0.6)) * 0.08 - 0.04;
    diffuseColor.rgb *= 1.0 + grain * detail;

    // Dashed centre line (only on roads wide enough for two lanes).
    float lineW = 0.09;
    float aaL = fwidth(lateral) * 1.2 + 1e-4;
    float centre = 1.0 - smoothstep(lineW - aaL, lineW + aaL, abs(lateral));
    float dashPhase = fract(along / 9.0);
    float aaD = fwidth(dashPhase) * 1.2 + 1e-4;
    float dash = smoothstep(0.0, aaD, dashPhase) * (1.0 - smoothstep(0.45 - aaD, 0.45 + aaD, dashPhase));
    centre *= dash * step(3.0, hw);

    // Solid edge lines on major roads.
    float edgeD = hw - abs(lateral) - 0.35;
    float edge = (1.0 - smoothstep(lineW - aaL, lineW + aaL, abs(edgeD))) * major;

    float mark = clamp(centre + edge, 0.0, 1.0) * detail;
    vec3 paint = mix(vec3(0.86, 0.86, 0.80), vec3(0.92, 0.78, 0.36), major * step(3.0, hw) * centre);
    diffuseColor.rgb = mix(diffuseColor.rgb, paint, mark * 0.75);
  }
}`
      );
  };
  material.customProgramCacheKey = () => "road-markings-v1";
}

/** OSM roads as flat batched ribbons, width/color by highway class, with a
 * pavement ribbon underneath in the detailed core and eye-level lane markings. */
export default function Roads() {
  const city = useMetroStore((s) => s.city);
  const visible = useMetroStore((s) => s.layers.roads);

  const geometry = useMemo(
    () => (city ? buildGeometry(city.roads, { z: ROAD_Z, pad: 0, markings: true }) : null),
    [city]
  );
  const sidewalk = useMemo(
    () =>
      city
        ? buildGeometry(city.roads, {
            z: SIDEWALK_Z,
            pad: SIDEWALK_EACH,
            color: new THREE.Color(SIDEWALK_COLOR),
            maxRadius: DETAIL_RADIUS_M,
          })
        : null,
    [city]
  );

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    applyMarkingShader(m);
    return m;
  }, []);

  useEffect(
    () => () => {
      geometry?.dispose();
      sidewalk?.dispose();
    },
    [geometry, sidewalk]
  );
  useEffect(() => () => material.dispose(), [material]);

  if (!city || !visible || !geometry) return null;

  return (
    <group name="roads">
      <mesh geometry={geometry} material={material} receiveShadow />
      {sidewalk && (
        <mesh geometry={sidewalk} receiveShadow>
          <meshStandardMaterial
            vertexColors
            roughness={0.9}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={-1.5}
            polygonOffsetUnits={-1.5}
          />
        </mesh>
      )}
    </group>
  );
}
