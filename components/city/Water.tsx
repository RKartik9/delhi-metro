"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { useFrame } from "@react-three/fiber";
import { useMetroStore } from "@/stores/useMetroStore";
import { computeAtmosphere } from "@/utils/atmosphere";

const WATER_Z = 0.6;

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSunDir;
  varying vec3 vWorld;
  #include <fog_pars_fragment>

  vec3 rippleNormal(vec2 p) {
    float t = uTime;
    vec2 g = vec2(
      cos(p.x * 0.05 + t * 0.8) * 0.05 + cos((p.x + p.y) * 0.03 + t) * 0.03,
      -sin(p.y * 0.045 - t * 0.6) * 0.045 + cos((p.x + p.y) * 0.03 + t) * 0.03
    );
    return normalize(vec3(-g * 0.7, 1.0));
  }

  void main() {
    vec3 N = rippleNormal(vWorld.xy);
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 col = mix(uDeep, uShallow, clamp(fres, 0.0, 1.0));
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 60.0);
    col += spec * vec3(1.0, 0.97, 0.9) * 0.7;
    gl_FragColor = vec4(col, 0.86);
    #include <fog_fragment>
  }
`;

/** Yamuna + lakes: translucent, animated, fog-aware water surfaces. */
export default function Water() {
  const city = useMetroStore((s) => s.city);
  const visible = useMetroStore((s) => s.layers.water);
  const timeOfDay = useMetroStore((s) => s.timeOfDay);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const atm = useMemo(() => computeAtmosphere(timeOfDay), [timeOfDay]);

  const geometry = useMemo(() => {
    if (!city) return null;
    const geos: THREE.BufferGeometry[] = [];
    for (const item of city.water) {
      if (item.r.length < 6) continue;
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i < item.r.length; i += 2) {
        pts.push(new THREE.Vector2(item.r[i], item.r[i + 1]));
      }
      try {
        geos.push(new THREE.ShapeGeometry(new THREE.Shape(pts)));
      } catch {
        /* skip malformed polygon */
      }
    }
    if (geos.length === 0) return null;
    const merged = mergeBufferGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    return merged;
  }, [city]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color("#173b5e") },
            uShallow: { value: new THREE.Color("#4d90b8") },
            uSunDir: { value: new THREE.Vector3(4000, 2800, 6500).normalize() },
          },
        ]),
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        fog: true,
        side: THREE.DoubleSide,
        // Depth-decal offset: keeps the water surface stably above the
        // greenery/ground layers without relying on raw depth precision.
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    []
  );

  useEffect(() => {
    matRef.current = material;
    return () => {
      geometry?.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, dt) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value += dt;
    (m.uniforms.uSunDir.value as THREE.Vector3).copy(atm.sunDir);
    (m.uniforms.uShallow.value as THREE.Color).lerpColors(
      new THREE.Color("#123049"),
      new THREE.Color("#4d90b8"),
      atm.day
    );
  });

  if (!city || !visible || !geometry) return null;

  return (
    <mesh geometry={geometry} material={material} position={[0, 0, WATER_Z]} />
  );
}
