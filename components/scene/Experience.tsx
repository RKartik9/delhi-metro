"use client";

import { useMemo, useRef } from "react";
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
import { useMetroStore } from "@/stores/useMetroStore";
import { computeAtmosphere } from "@/utils/atmosphere";

/** Metric world extents (meters). Ground/fog/shadows are sized to the core. */
const GROUND_SIZE = 400_000;
const CORE_RADIUS = 6_000;
const SUN_DISTANCE = 9_000;

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

  // Keep the sun (and its shadow frustum) positioned along the sun direction.
  useFrame(() => {
    const sun = sunRef.current;
    if (!sun) return;
    sun.position.set(
      atm.sunDir.x * SUN_DISTANCE,
      atm.sunDir.y * SUN_DISTANCE,
      Math.max(atm.sunDir.z, 0.05) * SUN_DISTANCE
    );
  });

  return (
    <>
      <color attach="background" args={[atm.skyHorizon]} />
      <fog attach="fog" args={[atm.fogColor, 4_500, 26_000]} />

      <SkyDome atmosphere={atm} />

      {/* Lighting (Z-up: light comes from high +Z), sun driven by time of day. */}
      <ambientLight intensity={atm.ambient} />
      <hemisphereLight
        args={[atm.hemiSky, atm.hemiGround, atm.hemiIntensity]}
      />
      <directionalLight
        ref={sunRef}
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
        <Stars radius={120_000} depth={40_000} count={4000} factor={600} fade speed={0.5} />
      )}

      {/* Ground: planeGeometry lies in the X/Y plane by default (normal = +Z). */}
      <mesh position={[0, 0, -0.1]} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color={atm.groundColor} roughness={1} metalness={0} />
      </mesh>

      {/* The 3D OSM city (buildings, water, roads, greenery) */}
      <CityWorld />

      {/* Metro network + stations + animated trains + active journey */}
      <MetroNetwork />
      <Stations />
      <Trains />
      <Journey />

      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, 0, 0]}
        minDistance={10}
        maxDistance={70_000}
        autoRotate={cameraMode === "fly"}
        autoRotateSpeed={0.6}
        maxPolarAngle={cameraMode === "free" ? Math.PI - 0.05 : Math.PI / 2.05}
      />
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
