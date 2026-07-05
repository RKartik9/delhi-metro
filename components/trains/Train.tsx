"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMetroStore } from "@/stores/useMetroStore";
import { followTarget } from "@/utils/followTarget";

/** Base linear speed of a train, in meters per second (before store multiplier). */
const BASE_SPEED = 22;

interface TrainProps {
  curve: THREE.CatmullRomCurve3;
  /** Arc length of the curve, used to normalise speed across lines. */
  length: number;
  color: string;
  /** Initial travel direction: +1 (t increasing) or -1. */
  direction: 1 | -1;
  /** Initial position along the curve, 0..1. */
  phase: number;
  /** When true, this train writes its transform to the follow-camera target. */
  followed: boolean;
}

// Reusable scratch objects (frame callbacks run synchronously, single-threaded).
const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _f = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _up = new THREE.Vector3(0, 0, 1);
const _mat = new THREE.Matrix4();

export default function Train({
  curve,
  length,
  color,
  direction,
  phase,
  followed,
}: TrainProps) {
  const groupRef = useRef<THREE.Group>(null);
  const progress = useRef(THREE.MathUtils.clamp(phase, 0, 1));
  const dir = useRef<number>(direction);

  // Window / accent color derived from the line color for a subtle glow.
  const accent = useMemo(() => {
    const c = new THREE.Color(color);
    c.lerp(new THREE.Color("#ffffff"), 0.55);
    return c;
  }, [color]);

  useFrame((_, rawDelta) => {
    const group = groupRef.current;
    if (!group) return;

    const { animationPlaying, trainSpeed } = useMetroStore.getState();
    const dt = Math.min(rawDelta, 0.05);

    if (animationPlaying && length > 0) {
      const dp = ((BASE_SPEED * trainSpeed) / length) * dt;
      let p = progress.current + dir.current * dp;
      // Ping-pong at the terminals so trains reverse like real services.
      if (p >= 1) {
        p = 1 - (p - 1);
        dir.current = -1;
      } else if (p <= 0) {
        p = -p;
        dir.current = 1;
      }
      progress.current = THREE.MathUtils.clamp(p, 0, 1);
    }

    const t = progress.current;
    curve.getPointAt(t, _pos);
    curve.getTangentAt(t, _tan).normalize();

    // Forward points in the actual travel direction.
    _f.copy(_tan).multiplyScalar(dir.current).normalize();
    _y.crossVectors(_up, _f).normalize();
    _z.crossVectors(_f, _y).normalize();
    _mat.makeBasis(_f, _y, _z);

    group.position.copy(_pos);
    group.quaternion.setFromRotationMatrix(_mat);

    if (followed) {
      followTarget.hasTarget = true;
      followTarget.position.copy(_pos);
      followTarget.forward.copy(_f);
    }
  });

  // Local axes: X = forward (length), Y = width, Z = up (height).
  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0, 2.6]} castShadow>
        <boxGeometry args={[15, 5.4, 4.2]} />
        <meshStandardMaterial
          color={color}
          metalness={0.35}
          roughness={0.45}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Roof accent strip */}
      <mesh position={[0, 0, 4.75]}>
        <boxGeometry args={[15.1, 3.2, 0.4]} />
        <meshStandardMaterial color={accent} metalness={0.2} roughness={0.6} />
      </mesh>

      {/* Window band (both sides) */}
      <mesh position={[0, 0, 3.4]}>
        <boxGeometry args={[11, 5.7, 1.7]} />
        <meshStandardMaterial
          color="#0a0f1a"
          emissive={accent}
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>

      {/* Door slits */}
      {[-3.5, 3.5].map((x) =>
        [-2.75, 2.75].map((y) => (
          <mesh key={`${x}:${y}`} position={[x, y, 2.4]}>
            <boxGeometry args={[0.35, 0.15, 3.2]} />
            <meshStandardMaterial color="#05070c" roughness={0.9} />
          </mesh>
        ))
      )}

      {/* Headlights (front, +X) */}
      {[-1.7, 1.7].map((y) => (
        <mesh key={`h${y}`} position={[7.55, y, 2.3]}>
          <sphereGeometry args={[0.55, 12, 12]} />
          <meshStandardMaterial
            color="#fffbe6"
            emissive="#fff3b0"
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Tail lights (rear, -X) */}
      {[-1.7, 1.7].map((y) => (
        <mesh key={`t${y}`} position={[-7.55, y, 2.3]}>
          <sphereGeometry args={[0.45, 10, 10]} />
          <meshStandardMaterial
            color="#ff3b30"
            emissive="#ff2a20"
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
