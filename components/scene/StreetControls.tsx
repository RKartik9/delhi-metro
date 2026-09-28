"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useMetroStore } from "@/stores/useMetroStore";
import { streetRig } from "@/utils/streetRig";
import { resolveMove } from "@/utils/buildingCollision";

/** Eye height above the ground plane (roads sit at z 0.9). */
export const EYE_Z = 2.4;

/** Street-level lens vs. the aerial defaults from SceneCanvas. */
const STREET_LENS = { fov: 68, near: 0.5, far: 15_000 };
const AERIAL_LENS = { fov: 50, near: 10, far: 60_000 };

const LOOK_SENS = 0.0025; // rad per px
const PITCH_MIN = THREE.MathUtils.degToRad(-75);
const PITCH_MAX = THREE.MathUtils.degToRad(85);
const WALK_SPEED = 6; // m/s
const RUN_MULT = 3;
const TURN_SPEED = 1.6; // rad/s for Q/E
const WHEEL_METERS = 0.045; // meters per wheel deltaY unit
const CLICK_MAX_PX = 4;
const CLICK_MAX_DIST = 600; // ignore clicks on the far horizon
const SWOOP_SECONDS = 1.4;

const MOVE_KEYS = new Set([
  "w", "a", "s", "d", "q", "e",
  "arrowup", "arrowdown", "arrowleft", "arrowright", "shift",
]);

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _look = new THREE.Vector3();
const _goalQ = new THREE.Quaternion();
const _tmpCam = new THREE.PerspectiveCamera();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _ground = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _hit = new THREE.Vector3();

const smooth = (t: number) => t * t * (3 - 2 * t);

function forwardFrom(yaw: number, pitch: number, out: THREE.Vector3) {
  const c = Math.cos(pitch);
  return out.set(Math.cos(yaw) * c, Math.sin(yaw) * c, Math.sin(pitch));
}

function applyLens(
  camera: THREE.PerspectiveCamera,
  lens: { fov: number; near: number; far: number }
) {
  Object.assign(camera, lens);
  camera.updateProjectionMatrix();
}

function setCanvasStyle(el: HTMLElement, cursor: string, touchAction: string) {
  Object.assign(el.style, { cursor, touchAction });
}

function publish(p: THREE.Vector3, yaw: number, pitch: number) {
  streetRig.position.copy(p);
  streetRig.yaw = yaw;
  streetRig.pitch = pitch;
}

/**
 * Google-Earth-style ground-level camera rig:
 *  - drag to look around (grab-and-pull), cursor stays visible
 *  - W/A/S/D or arrows walk, Q/E turn, Shift runs, wheel moves forward/back
 *  - click (without dragging) glides to that spot on the ground
 *  - buildings block movement (footprint collision with wall sliding)
 *  - swoops in from the aerial camera on entry
 * Owns the camera while mounted; MapControls is unmounted during street mode.
 */
export default function StreetControls() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const spawn = useMetroStore((s) => s.streetSpawn);

  const pos = useRef(new THREE.Vector3(0, 0, EYE_Z));
  const yaw = useRef(Math.PI / 2);
  const pitch = useRef(0);
  const vel = useRef(new THREE.Vector2()); // planar velocity (m/s)
  const wheelVel = useRef(0); // forward impulse (m/s), decays
  const glideTo = useRef<THREE.Vector3 | null>(null);
  const keys = useRef(new Set<string>());
  const swoop = useRef<{
    t: number;
    from: THREE.Vector3;
    fromQ: THREE.Quaternion;
  } | null>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    sx: number;
    sy: number;
    moved: boolean;
  } | null>(null);

  // Lens swap for eye-level viewing; restore the aerial lens on exit.
  useEffect(() => {
    applyLens(camera, STREET_LENS);
    streetRig.active = true;
    return () => {
      applyLens(camera, AERIAL_LENS);
      streetRig.active = false;
    };
  }, [camera]);

  // (Re)spawn: swoop from the current camera pose to the requested spot.
  useEffect(() => {
    if (!spawn) return;
    pos.current.set(spawn.x, spawn.y, EYE_Z);
    yaw.current = spawn.yaw;
    pitch.current = THREE.MathUtils.degToRad(2);
    vel.current.set(0, 0);
    wheelVel.current = 0;
    glideTo.current = null;
    swoop.current = {
      t: 0,
      from: camera.position.clone(),
      fromQ: camera.quaternion.clone(),
    };
  }, [spawn, camera]);

  // Pointer: drag to look, click to walk there.
  useEffect(() => {
    const el = gl.domElement;
    const prevCursor = el.style.cursor;
    const prevTouch = el.style.touchAction;
    setCanvasStyle(el, "grab", "none");

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        moved: false,
      };
      el.setPointerCapture?.(e.pointerId);
      setCanvasStyle(el, "grabbing", "none");
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > CLICK_MAX_PX) {
        d.moved = true;
        swoop.current = null; // grabbing the view cancels the fly-in
      }
      if (!d.moved) return;
      // Grab-and-pull: drag right pulls the world right, so you turn left.
      yaw.current += dx * LOOK_SENS;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current + dy * LOOK_SENS,
        PITCH_MIN,
        PITCH_MAX
      );
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      setCanvasStyle(el, "grab", "none");
      el.releasePointerCapture?.(e.pointerId);
      if (d.moved || swoop.current) return;

      // Plain click: glide to the clicked point on the ground.
      const rect = el.getBoundingClientRect();
      _ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      _ray.setFromCamera(_ndc, camera);
      const hit = _ray.ray.intersectPlane(_ground, _hit);
      if (!hit) return;
      const dist = Math.hypot(hit.x - pos.current.x, hit.y - pos.current.y);
      if (dist < 1 || dist > CLICK_MAX_DIST) return;
      glideTo.current = new THREE.Vector3(hit.x, hit.y, EYE_Z);
    };
    const onCancel = (e: PointerEvent) => {
      if (drag.current?.id === e.pointerId) {
        drag.current = null;
        setCanvasStyle(el, "grab", "none");
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      wheelVel.current += -e.deltaY * unit * WHEEL_METERS * 4;
      glideTo.current = null;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("wheel", onWheel);
      setCanvasStyle(el, prevCursor, prevTouch);
    };
  }, [gl, camera]);

  // Keyboard: held-key set for walking.
  useEffect(() => {
    const held = keys.current;
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    };
    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (!MOVE_KEYS.has(k)) return;
      if (k.startsWith("arrow")) e.preventDefault();
      held.add(k);
      glideTo.current = null;
    };
    const onUp = (e: KeyboardEvent) => {
      held.delete(e.key.toLowerCase());
    };
    const onBlur = () => held.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      held.clear();
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = pos.current;
    const city = useMetroStore.getState().city;
    const k = keys.current;

    // --- Entry swoop -------------------------------------------------------
    const sw = swoop.current;
    if (sw) {
      sw.t = Math.min(1, sw.t + dt / SWOOP_SECONDS);
      const s = smooth(sw.t);
      forwardFrom(yaw.current, pitch.current, _forward);
      _tmpCam.position.copy(p);
      _tmpCam.up.set(0, 0, 1);
      _tmpCam.lookAt(_look.copy(p).add(_forward));
      _goalQ.copy(_tmpCam.quaternion);

      camera.position.lerpVectors(sw.from, p, s);
      camera.quaternion.slerpQuaternions(sw.fromQ, _goalQ, s);
      if (sw.t >= 1) swoop.current = null;
      publish(p, yaw.current, pitch.current);
      return;
    }

    // --- Turning (Q/E) -----------------------------------------------------
    if (k.has("q")) yaw.current += TURN_SPEED * dt;
    if (k.has("e")) yaw.current -= TURN_SPEED * dt;

    // --- Desired planar velocity from keys ---------------------------------
    const cy = Math.cos(yaw.current);
    const sy = Math.sin(yaw.current);
    _forward.set(cy, sy, 0);
    _right.set(sy, -cy, 0);

    let fwd = 0;
    let str = 0;
    if (k.has("w") || k.has("arrowup")) fwd += 1;
    if (k.has("s") || k.has("arrowdown")) fwd -= 1;
    if (k.has("d") || k.has("arrowright")) str += 1;
    if (k.has("a") || k.has("arrowleft")) str -= 1;

    const speed = WALK_SPEED * (k.has("shift") ? RUN_MULT : 1);
    let dx = (_forward.x * fwd + _right.x * str) * speed;
    let dy = (_forward.y * fwd + _right.y * str) * speed;
    if (fwd !== 0 && str !== 0) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }

    // Glide toward a clicked point (overrides keys until interrupted).
    const g = glideTo.current;
    if (g) {
      const gx = g.x - p.x;
      const gy = g.y - p.y;
      const gd = Math.hypot(gx, gy);
      if (gd < 0.3) {
        glideTo.current = null;
      } else {
        const gs = Math.min(Math.max(8, gd * 1.6), 40);
        dx = (gx / gd) * gs;
        dy = (gy / gd) * gs;
      }
    }

    // Smooth acceleration / deceleration.
    const accel = 1 - Math.pow(0.0005, dt);
    const v = vel.current;
    v.x += (dx - v.x) * accel;
    v.y += (dy - v.y) * accel;

    // Wheel impulse along the look direction (planar), with decay.
    const wv = wheelVel.current;
    wheelVel.current *= Math.pow(0.02, dt);
    if (Math.abs(wheelVel.current) < 0.05) wheelVel.current = 0;

    const nx = p.x + (v.x + _forward.x * wv) * dt;
    const ny = p.y + (v.y + _forward.y * wv) * dt;

    // Collide with buildings (slide along walls).
    const [rx, ry] = resolveMove(city, p.x, p.y, nx, ny);
    if (rx === p.x && ry === p.y && (nx !== p.x || ny !== p.y)) {
      // Fully blocked: kill momentum and any glide so we don't grind the wall.
      v.set(0, 0);
      wheelVel.current = 0;
      glideTo.current = null;
    }
    p.set(rx, ry, EYE_Z);

    // --- Apply to camera ---------------------------------------------------
    camera.position.copy(p);
    forwardFrom(yaw.current, pitch.current, _forward);
    camera.up.set(0, 0, 1);
    camera.lookAt(_look.copy(p).add(_forward));
    publish(p, yaw.current, pitch.current);
  });

  return null;
}
