"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useMetroStore } from "@/stores/useMetroStore";
import { followTarget } from "@/utils/followTarget";
import { streetRig } from "@/utils/streetRig";

// Minimal shape of the drei/three-stdlib OrbitControls we rely on.
interface OrbitLike {
  target: THREE.Vector3;
  update: () => void;
  autoRotate: boolean;
  autoRotateSpeed: number;
  maxPolarAngle: number;
  addEventListener: (t: string, cb: () => void) => void;
  removeEventListener: (t: string, cb: () => void) => void;
}

/** Viewing direction for framed shots (a 3/4 bird's-eye in the Z-up world). */
const DIR = new THREE.Vector3(0, -1, 0.85).normalize();
const TOP_DIR = new THREE.Vector3(0, -0.28, 1).normalize();
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const DEFAULT_POS = new THREE.Vector3(0, -4500, 3200);

/** Chase-camera offsets in follow mode (meters). */
const FOLLOW_BACK = 90;
const FOLLOW_UP = 42;

/** Lift-off after street view: bird's-eye distance above where you stood. */
const STREET_EXIT_DIST = 500;
/** How far ahead of the eye the orbit target is seeded on street exit. */
const STREET_EXIT_AHEAD = 40;

/** Distance (meters) below which an animated fly-to is considered complete. */
const ARRIVE_EPS = 25;

// Scratch objects for the follow chase camera.
const _followPos = new THREE.Vector3();
const _followTgt = new THREE.Vector3();

function framing(points: THREE.Vector3[]) {
  const box = new THREE.Box3();
  for (const p of points) box.expandByPoint(p);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 400) * 0.5;
  return { center, radius };
}

/**
 * Drives smooth, animated camera transitions on top of OrbitControls:
 *  - flies to a selected station or line
 *  - supports orbit / top / fly (auto-rotate) / free camera modes
 *  - all transitions interpolate (no abrupt jumps)
 */
export default function CameraController() {
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const data = useMetroStore((s) => s.data);
  const mode = useMetroStore((s) => s.cameraMode);
  const selectedStationId = useMetroStore((s) => s.selectedStationId);
  const selectedLineId = useMetroStore((s) => s.selectedLineId);
  const route = useMetroStore((s) => s.route);

  const goalPos = useRef(new THREE.Vector3().copy(DEFAULT_POS));
  const goalTarget = useRef(new THREE.Vector3().copy(DEFAULT_TARGET));
  const animating = useRef(false);
  const prevMode = useRef(mode);
  const pendingStreetExit = useRef(false);

  // Compute a new goal whenever the selection or mode changes.
  useEffect(() => {
    const cameFromStreet = prevMode.current === "street" && mode !== "street";
    prevMode.current = mode;

    // The street rig owns the camera; nothing to animate here.
    if (mode === "street") {
      animating.current = false;
      return;
    }

    let center = DEFAULT_TARGET.clone();
    let pos = DEFAULT_POS.clone();
    const fovRad = (camera.fov * Math.PI) / 180;

    if (cameFromStreet && !route && !selectedStationId && !selectedLineId) {
      // Lift off to a 3/4 view above the spot where the user was standing.
      center = new THREE.Vector3(streetRig.position.x, streetRig.position.y, 0);
      pos = center.clone().add(DIR.clone().multiplyScalar(STREET_EXIT_DIST));
      pendingStreetExit.current = true;
    } else if (route && data) {
      const pts = route.stationIds
        .map((id) => data.stationsById[id])
        .filter(Boolean)
        .map((s) => new THREE.Vector3(s.position[0], s.position[1], 40));
      const { center: c, radius } = framing(pts.length ? pts : [DEFAULT_TARGET]);
      center = c;
      const dist = Math.max(900, radius / Math.tan(fovRad * 0.5)) * 1.3;
      pos = center.clone().add(DIR.clone().multiplyScalar(dist));
    } else if (selectedStationId && data?.stationsById[selectedStationId]) {
      const p = data.stationsById[selectedStationId].position;
      center = new THREE.Vector3(p[0], p[1], 30);
      pos = center.clone().add(DIR.clone().multiplyScalar(600));
    } else if (selectedLineId && data?.linesById[selectedLineId]) {
      const line = data.linesById[selectedLineId];
      const pts = line.stationIds
        .map((id) => data.stationsById[id])
        .filter(Boolean)
        .map((s) => new THREE.Vector3(s.position[0], s.position[1], s.position[2]));
      const { center: c, radius } = framing(pts.length ? pts : [DEFAULT_TARGET]);
      center = c;
      const dist = Math.max(900, radius / Math.tan(fovRad * 0.5)) * 1.25;
      pos = center.clone().add(DIR.clone().multiplyScalar(dist));
    } else if (mode === "top") {
      center = DEFAULT_TARGET.clone();
      pos = center.clone().add(TOP_DIR.clone().multiplyScalar(55_000));
    } else {
      center = DEFAULT_TARGET.clone();
      pos = DEFAULT_POS.clone();
    }

    goalTarget.current.copy(center);
    goalPos.current.copy(pos);
    animating.current = true;
  }, [data, mode, selectedStationId, selectedLineId, route, camera]);

  // Leaving street view: MapControls has just (re)mounted with its target at
  // the origin. Seed the target directly ahead of the eye so its first
  // update() reproduces the street view exactly, then the lift-off lerp runs.
  useEffect(() => {
    if (!controls || mode === "street") return;
    const p = streetRig.position;
    if (pendingStreetExit.current || camera.position.distanceTo(p) < 1) {
      pendingStreetExit.current = false;
      controls.target.set(
        p.x + Math.cos(streetRig.yaw) * STREET_EXIT_AHEAD,
        p.y + Math.sin(streetRig.yaw) * STREET_EXIT_AHEAD,
        p.z + Math.sin(streetRig.pitch) * STREET_EXIT_AHEAD
      );
      controls.update();
      animating.current = true;
    }
  }, [controls, mode, camera]);

  // Hand camera control back to the user as soon as they start dragging.
  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      animating.current = false;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, dt) => {
    if (!controls) return;
    if (useMetroStore.getState().cameraMode === "street") return;
    const step = Math.min(dt, 0.05);

    // Remember what the aerial camera is looking at so "Street" can drop in there.
    streetRig.mapFocus.copy(controls.target);
    streetRig.mapFocusDist = camera.position.distanceTo(controls.target);

    // Follow mode: chase the followed train continuously, from just behind it.
    if (useMetroStore.getState().cameraMode === "follow" && followTarget.hasTarget) {
      _followTgt.copy(followTarget.position);
      _followPos
        .copy(followTarget.position)
        .addScaledVector(followTarget.forward, -FOLLOW_BACK);
      _followPos.z += FOLLOW_UP;
      const chase = 1 - Math.pow(0.0009, step);
      camera.position.lerp(_followPos, chase);
      controls.target.lerp(_followTgt, chase);
      controls.update();
      animating.current = false;
      return;
    }

    if (!animating.current) return;
    const a = 1 - Math.pow(0.0025, step);
    camera.position.lerp(goalPos.current, a);
    controls.target.lerp(goalTarget.current, a);
    controls.update();
    if (
      camera.position.distanceTo(goalPos.current) < ARRIVE_EPS &&
      controls.target.distanceTo(goalTarget.current) < ARRIVE_EPS
    ) {
      camera.position.copy(goalPos.current);
      controls.target.copy(goalTarget.current);
      controls.update();
      animating.current = false;
    }
  });

  return null;
}
