"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMetroStore } from "@/stores/useMetroStore";
import type { RoadItem } from "@/types/city";

const CAR_CAP = 340;
const CAR_Z = 1.6;
const MAJOR = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "motorway_link",
  "trunk_link",
  "primary_link",
]);
const CAR_COLORS = ["#e8e8ee", "#2f3540", "#9aa3ad", "#7c1f26", "#26507c", "#c7a04a"];

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RoadPath {
  pts: number[];
  cum: number[];
  total: number;
}

interface Car {
  road: RoadPath;
  speed: number; // m/s (signed by direction)
  lane: number; // perpendicular offset (m)
  color: THREE.Color;
}

function buildRoad(r: RoadItem): RoadPath | null {
  const n = r.p.length / 2;
  if (n < 2) return null;
  const cum = [0];
  let total = 0;
  for (let i = 0; i < n - 1; i++) {
    const dx = r.p[(i + 1) * 2] - r.p[i * 2];
    const dy = r.p[(i + 1) * 2 + 1] - r.p[i * 2 + 1];
    total += Math.hypot(dx, dy);
    cum.push(total);
  }
  return { pts: r.p, cum, total };
}

/** Bounded, animated instanced cars flowing along the major road network. */
export default function Traffic() {
  const city = useMetroStore((s) => s.city);
  const roadsVisible = useMetroStore((s) => s.layers.roads);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dist = useRef<Float32Array>(new Float32Array(0));

  const cars = useMemo<Car[]>(() => {
    if (!city) return [];
    const rng = makeRng(1337);
    const out: Car[] = [];
    for (const r of city.roads) {
      if (!MAJOR.has(r.c)) continue;
      const road = buildRoad(r);
      if (!road || road.total < 160) continue;
      const num = Math.min(4, 1 + Math.floor(road.total / 700));
      for (let k = 0; k < num; k++) {
        const dir = rng() > 0.5 ? 1 : -1;
        out.push({
          road,
          speed: dir * (16 + rng() * 12),
          lane: dir * (r.w * 0.25 + 1),
          color: new THREE.Color(CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)]),
        });
        if (out.length >= CAR_CAP) return out;
      }
    }
    return out;
  }, [city]);

  const geometry = useMemo(() => new THREE.BoxGeometry(4.6, 2.0, 1.5), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Seed initial positions once cars are known.
  useEffect(() => {
    const rng = makeRng(7);
    const arr = new Float32Array(cars.length);
    for (let i = 0; i < cars.length; i++) arr[i] = rng() * cars[i].road.total;
    dist.current = arr;
    const mesh = meshRef.current;
    if (mesh) for (let i = 0; i < cars.length; i++) mesh.setColorAt(i, cars[i].color);
    if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cars]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, rawDt) => {
    const mesh = meshRef.current;
    const d = dist.current;
    if (!mesh || cars.length === 0 || d.length !== cars.length) return;
    const dt = Math.min(rawDt, 0.05);

    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const { pts, cum, total } = car.road;
      let s = d[i] + car.speed * dt;
      s = ((s % total) + total) % total;
      d[i] = s;

      // Locate the segment containing distance s.
      let seg = 0;
      while (seg < cum.length - 2 && cum[seg + 1] < s) seg++;
      const segLen = cum[seg + 1] - cum[seg] || 1;
      const f = (s - cum[seg]) / segLen;
      const ax = pts[seg * 2];
      const ay = pts[seg * 2 + 1];
      const bx = pts[(seg + 1) * 2];
      const by = pts[(seg + 1) * 2 + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      dummy.position.set(
        ax + dx * f + nx * car.lane,
        ay + dy * f + ny * car.lane,
        CAR_Z
      );
      dummy.rotation.set(0, 0, Math.atan2(dy, dx));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!city || !roadsVisible || cars.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, cars.length]} castShadow>
      <meshStandardMaterial roughness={0.4} metalness={0.4} />
    </instancedMesh>
  );
}
