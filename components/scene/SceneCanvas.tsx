"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import Experience from "./Experience";
import { useMetroStore } from "@/stores/useMetroStore";

// Z-up world (GIS/CAD convention): Z = height, ground lies on the X/Y plane.
// Setting the global default up ensures cameras, controls, and lookAt() all
// treat +Z as up throughout the app.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

/**
 * Root WebGL canvas. Camera / renderer defaults are tuned for a bird's-eye view
 * of the Delhi Metro scene; scene contents live in <Experience />.
 */
export default function SceneCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      camera={{
        position: [0, -4500, 3200],
        up: [0, 0, 1],
        fov: 50,
        near: 3,
        far: 100000,
      }}
      onPointerMissed={() => useMetroStore.getState().clearSelection()}
    >
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
    </Canvas>
  );
}
