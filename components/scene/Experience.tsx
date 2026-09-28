"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  MapControls,
  GizmoHelper,
  GizmoViewport,
  Stars,
  AdaptiveDpr,
  AdaptiveEvents,
  Preload,
} from "@react-three/drei";
import MetroNetwork from "@/components/metro/MetroNetwork";
import Stations from "@/components/stations/Stations";
import Trains from "@/components/trains/Trains";
import Journey from "@/components/journey/Journey";
import CityWorld from "@/components/city/CityWorld";
import SkyDome from "./SkyDome";
import Effects from "./Effects";
import CameraController from "./CameraController";
import StreetControls from "./StreetControls";
import { useMetroStore } from "@/stores/useMetroStore";
import { computeAtmosphere } from "@/utils/atmosphere";

/** Metric world extents (meters). Ground/fog/shadows are sized to the core. */
const GROUND_SIZE = 400_000;
const CORE_RADIUS = 6_000;
const SUN_DISTANCE = 9_000;

/** Street mode: a tight shadow frustum that follows the walker for crisp
 * eye-level shadows, and a closer fog band that hides the detail-zone edge. */
const STREET_SHADOW_RADIUS = 350;
const STREET_SUN_DISTANCE = 2_000;
const STREET_FOG_NEAR = 1_500;
const STREET_FOG_FAR = 9_000;

/**
 * Flat ground plane with a little low-frequency colour variation near the
 * camera so open ground is not one flat tone at eye level. The variation fades
 * out with view distance so the aerial view is unchanged.
 */
function Ground({ color }: { color: THREE.Color }) {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vGroundXY;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGroundXY = position.xy;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec2 vGroundXY;
float groundHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float groundNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = groundHash(i);
  float b = groundHash(i + vec2(1.0, 0.0));
  float c = groundHash(i + vec2(0.0, 1.0));
  float d = groundHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
{
  float detail = 1.0 - smoothstep(400.0, 1600.0, length(vViewPosition));
  if (detail > 0.001) {
    float n = groundNoise(vGroundXY * 0.08) * 0.6 + groundNoise(vGroundXY * 0.7) * 0.4;
    // Warmer, slightly darker paving tone up close (the map-pale ground reads
    // like snow at eye level), plus low-frequency variation.
    vec3 paved = diffuseColor.rgb * vec3(0.86, 0.84, 0.80);
    diffuseColor.rgb = mix(diffuseColor.rgb, paved, detail) * (1.0 + (n - 0.5) * 0.16 * detail);
  }
}`
        );
    };
    m.customProgramCacheKey = () => "ground-v2";
    return m;
  }, []);

  useEffect(() => {
    material.color.copy(color);
  }, [color, material]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh position={[0, 0, -0.1]} receiveShadow material={material}>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
    </mesh>
  );
}

/**
 * The full 3D scene: time-of-day sky + lighting, ground, the metro network,
 * stations, animated trains, the active journey overlay, the OSM city, camera
 * rig, and screen-space post-processing.
 */
export default function Experience() {
  const cameraMode = useMetroStore((s) => s.cameraMode);
  const timeOfDay = useMetroStore((s) => s.timeOfDay);
  const atm = useMemo(() => computeAtmosphere(timeOfDay), [timeOfDay]);

  const sunRef = useRef<THREE.DirectionalLight>(null);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const fogRef = useRef<THREE.Fog>(null);
  const shadowModeRef = useRef<"aerial" | "street" | null>(null);
  const street = cameraMode === "street";

  // Keep the sun (and its shadow frustum) positioned along the sun direction,
  // and scale the fog with camera altitude so the full network stays visible
  // when zoomed out (fixed fog would white-out everything past 26 km).
  // In street mode the shadow frustum shrinks and follows the camera instead.
  useFrame(({ camera }) => {
    const sun = sunRef.current;
    if (sun) {
      const sunZ = Math.max(atm.sunDir.z, 0.05);
      const shadowCam = sun.shadow.camera;
      if (street) {
        sunTarget.position.set(camera.position.x, camera.position.y, 0);
        sun.position.set(
          sunTarget.position.x + atm.sunDir.x * STREET_SUN_DISTANCE,
          sunTarget.position.y + atm.sunDir.y * STREET_SUN_DISTANCE,
          sunZ * STREET_SUN_DISTANCE
        );
        if (shadowModeRef.current !== "street") {
          shadowCam.left = -STREET_SHADOW_RADIUS;
          shadowCam.right = STREET_SHADOW_RADIUS;
          shadowCam.top = STREET_SHADOW_RADIUS;
          shadowCam.bottom = -STREET_SHADOW_RADIUS;
          shadowCam.near = 10;
          shadowCam.far = STREET_SUN_DISTANCE * 3;
          shadowCam.updateProjectionMatrix();
          shadowModeRef.current = "street";
        }
      } else {
        sunTarget.position.set(0, 0, 0);
        sun.position.set(
          atm.sunDir.x * SUN_DISTANCE,
          atm.sunDir.y * SUN_DISTANCE,
          sunZ * SUN_DISTANCE
        );
        if (shadowModeRef.current !== "aerial") {
          shadowCam.left = -CORE_RADIUS;
          shadowCam.right = CORE_RADIUS;
          shadowCam.top = CORE_RADIUS;
          shadowCam.bottom = -CORE_RADIUS;
          shadowCam.near = 100;
          shadowCam.far = 20_000;
          shadowCam.updateProjectionMatrix();
          shadowModeRef.current = "aerial";
        }
      }
      sunTarget.updateMatrixWorld();
    }
    const fog = fogRef.current;
    if (fog) {
      if (street) {
        fog.near = STREET_FOG_NEAR;
        fog.far = STREET_FOG_FAR;
      } else {
        const dist = camera.position.length();
        fog.near = Math.max(4_500, dist * 1.1);
        fog.far = Math.max(26_000, dist * 3.5);
      }
    }
  });

  return (
    <>
      <color attach="background" args={[atm.skyHorizon]} />
      <fog ref={fogRef} attach="fog" args={[atm.fogColor, 4_500, 26_000]} />

      <SkyDome atmosphere={atm} />

      {/* Lighting (Z-up: light comes from high +Z), sun driven by time of day. */}
      <ambientLight intensity={atm.ambient} />
      <hemisphereLight
        args={[atm.hemiSky, atm.hemiGround, atm.hemiIntensity]}
      />
      <primitive object={sunTarget} />
      <directionalLight
        ref={sunRef}
        target={sunTarget}
        intensity={atm.sunIntensity}
        color={atm.sunColor}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-CORE_RADIUS}
        shadow-camera-right={CORE_RADIUS}
        shadow-camera-top={CORE_RADIUS}
        shadow-camera-bottom={-CORE_RADIUS}
        shadow-camera-near={100}
        shadow-camera-far={20_000}
        shadow-bias={-0.0004}
      />

      {atm.stars > 0.25 && (
        <Stars radius={35_000} depth={15_000} count={4000} factor={180} fade speed={0.5} />
      )}

      {/* Ground: planeGeometry lies in the X/Y plane by default (normal = +Z). */}
      <Ground color={atm.groundColor} />

      {/* The 3D OSM city (buildings, water, roads, greenery) */}
      <CityWorld />

      {/* Metro network + stations + animated trains + active journey */}
      <MetroNetwork />
      <Stations />
      <Trains />
      <Journey />

      {/* Aerial map controls, or the first-person street rig (which owns the
          camera outright; drei's MapControls would keep calling update()). */}
      {street ? (
        <StreetControls />
      ) : (
        <MapControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={[0, 0, 0]}
          minDistance={20}
          maxDistance={55_000}
          autoRotate={cameraMode === "fly"}
          autoRotateSpeed={0.6}
          maxPolarAngle={cameraMode === "free" ? Math.PI - 0.05 : Math.PI / 2.05}
        />
      )}
      <CameraController />

      <GizmoHelper alignment="top-right" margin={[72, 88]}>
        <GizmoViewport axisColors={["#ff5a6a", "#5aff8f", "#5a9dff"]} labelColor="white" />
      </GizmoHelper>

      <Effects />

      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
      <Preload all />
    </>
  );
}
