"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Atmosphere } from "@/utils/atmosphere";

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uDay;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float up = clamp(dir.z, -1.0, 1.0);
    // Sky gradient (Z is up); ground hemisphere fades to a darker horizon.
    float t = pow(clamp(up, 0.0, 1.0), 0.5);
    vec3 col = mix(uHorizon, uZenith, t);
    if (up < 0.0) col = mix(uHorizon, uHorizon * 0.55, clamp(-up * 2.0, 0.0, 1.0));

    // Sun disk + halo.
    float sd = clamp(dot(dir, normalize(uSunDir)), 0.0, 1.0);
    float disk = smoothstep(0.9993, 0.9998, sd);
    float halo = pow(sd, 220.0) * 0.5 + pow(sd, 12.0) * 0.12;
    col += uSunColor * (disk + halo) * (0.25 + uDay);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * A camera-following gradient sky dome with a sun disk/halo, driven by the
 * time-of-day atmosphere. Correct for the Z-up world (Z = zenith).
 */
export default function SkyDome({ atmosphere }: { atmosphere: Atmosphere }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uHorizon: { value: new THREE.Color() },
          uZenith: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color() },
          uDay: { value: 0 },
        },
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    []
  );

  useEffect(() => {
    matRef.current = material;
    return () => material.dispose();
  }, [material]);

  useFrame(({ camera }) => {
    const m = meshRef.current;
    if (m) m.position.copy(camera.position);
    const mat = matRef.current;
    if (!mat) return;
    const u = mat.uniforms;
    (u.uHorizon.value as THREE.Color).copy(atmosphere.skyHorizon);
    (u.uZenith.value as THREE.Color).copy(atmosphere.skyZenith);
    (u.uSunColor.value as THREE.Color).copy(atmosphere.sunColor);
    (u.uSunDir.value as THREE.Vector3).copy(atmosphere.sunDir);
    u.uDay.value = atmosphere.day;
  });

  return (
    <mesh ref={meshRef} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[40000, 32, 16]} />
    </mesh>
  );
}
