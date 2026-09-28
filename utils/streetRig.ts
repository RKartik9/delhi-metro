import * as THREE from "three";

/**
 * Transient, per-frame state of the street-level (first-person) camera rig.
 * Written by <StreetControls /> each frame; read by the HUD and by
 * <CameraController /> when handing the camera back to the map controls.
 * Kept outside the zustand store to avoid React re-renders 60x/second.
 */
export const streetRig = {
  /** True while the street rig owns the camera. */
  active: false,
  /** Eye position (scene meters, Z-up). */
  position: new THREE.Vector3(),
  /** Heading in radians, 0 = +X (east), counter-clockwise (pi/2 = north). */
  yaw: Math.PI / 2,
  /** Pitch in radians, 0 = level, positive = looking up. */
  pitch: 0,
  /**
   * Last known MapControls target (what the aerial camera is looking at).
   * Written by <CameraController /> so "Street" can drop in where you were
   * looking.
   */
  mapFocus: new THREE.Vector3(),
  /** Aerial camera distance to that target (meters); large = zoomed out. */
  mapFocusDist: Infinity,
};

/** Only treat the aerial focus as a drop-in point when zoomed in this close. */
export const MAP_FOCUS_MAX_DIST = 2_500;

/** Compass bearing in degrees (0 = north, 90 = east) from a scene yaw. */
export function yawToBearing(yaw: number): number {
  const deg = (90 - (yaw * 180) / Math.PI) % 360;
  return deg < 0 ? deg + 360 : deg;
}

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function bearingToCardinal(bearing: number): string {
  return CARDINALS[Math.round(bearing / 45) % 8];
}
