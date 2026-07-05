import * as THREE from "three";

/**
 * Transient, per-frame transform of the train the camera should follow.
 * Written by the followed <Train /> each frame and read by <CameraController />.
 * Kept outside the store to avoid triggering React re-renders 60x/second.
 */
export const followTarget = {
  hasTarget: false,
  position: new THREE.Vector3(),
  /** Unit travel direction of the followed train (points where it is heading). */
  forward: new THREE.Vector3(1, 0, 0),
};
