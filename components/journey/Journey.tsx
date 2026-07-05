"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMetroStore } from "@/stores/useMetroStore";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { MetroData, RoutePlan } from "@/types/metro";

/** Height at which the journey ribbon floats above the network (meters). */
const JOURNEY_Z = 60;
/** Marker travel speed along the path (meters / second). */
const MARKER_SPEED = 650;

function stationVec(data: MetroData, id: string): THREE.Vector3 | null {
  const s = data.stationsById[id];
  if (!s) return null;
  return new THREE.Vector3(s.position[0], s.position[1], JOURNEY_Z);
}

/** Renders the active journey: per-line ribbon, endpoints, interchanges, marker. */
export default function Journey() {
  const data = useMetroStore((s) => s.data);
  const route = useMetroStore((s) => s.route);

  if (!data || !route) return null;
  return <JourneyContent data={data} route={route} />;
}

function JourneyContent({ data, route }: { data: MetroData; route: RoutePlan }) {
  const reduced = usePrefersReducedMotion();

  // One tube per single-line segment, in that line's colour.
  const tubes = useMemo(() => {
    return route.segments
      .map((seg) => {
        const pts = seg.stationIds
          .map((id) => stationVec(data, id))
          .filter((v): v is THREE.Vector3 => v !== null);
        if (pts.length < 2) return null;
        const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
        const geom = new THREE.TubeGeometry(
          curve,
          Math.max(24, pts.length * 6),
          10,
          10,
          false
        );
        return { geom, color: data.linesById[seg.lineId]?.color ?? "#ffffff" };
      })
      .filter((t): t is { geom: THREE.TubeGeometry; color: string } => t !== null);
  }, [data, route]);

  // A single curve over the whole path drives the moving marker.
  const fullCurve = useMemo(() => {
    const pts = route.stationIds
      .map((id) => stationVec(data, id))
      .filter((v): v is THREE.Vector3 => v !== null);
    if (pts.length < 2) return null;
    return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
  }, [data, route]);

  const curveLength = useMemo(
    () => fullCurve?.getLength() ?? 0,
    [fullCurve]
  );

  useEffect(() => {
    const geoms = tubes.map((t) => t.geom);
    return () => geoms.forEach((g) => g.dispose());
  }, [tubes]);

  const markerRef = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const _p = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDelta) => {
    const group = markerRef.current;
    if (!group || !fullCurve || curveLength === 0) return;
    const { journeyPlaying } = useMetroStore.getState();

    if (reduced) {
      progress.current = 1;
    } else if (journeyPlaying) {
      const dt = Math.min(rawDelta, 0.05);
      progress.current += (MARKER_SPEED / curveLength) * dt;
      if (progress.current > 1) progress.current = 0; // loop the tour
    }
    fullCurve.getPointAt(THREE.MathUtils.clamp(progress.current, 0, 1), _p);
    group.position.copy(_p);
  });

  const origin = stationVec(data, route.fromId);
  const destination = stationVec(data, route.toId);

  return (
    <group>
      {tubes.map((t, i) => (
        <group key={i}>
          <mesh geometry={t.geom}>
            <meshBasicMaterial color={t.color} toneMapped={false} />
          </mesh>
          <mesh geometry={t.geom} scale={1.9}>
            <meshBasicMaterial
              color={t.color}
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {route.interchangeIds.map((id) => {
        const v = stationVec(data, id);
        return v ? <InterchangeRing key={id} position={v} reduced={reduced} /> : null;
      })}

      {origin && <Endpoint position={origin} color="#4ade80" />}
      {destination && <Endpoint position={destination} color="#f87171" />}

      {/* Travelling marker */}
      <group ref={markerRef}>
        <mesh>
          <sphereGeometry args={[18, 20, 20]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh scale={2.1}>
          <sphereGeometry args={[18, 16, 16]} />
          <meshBasicMaterial
            color="#bfe6ff"
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <pointLight color="#cfe8ff" intensity={6000} distance={900} decay={2} />
      </group>
    </group>
  );
}

function Endpoint({
  position,
  color,
}: {
  position: THREE.Vector3;
  color: string;
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[22, 20, 20]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Vertical beam down to the ground (cylinder is Y-up, rotate to Z-up). */}
      <mesh position={[0, 0, -JOURNEY_Z / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3, 3, JOURNEY_Z, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.45}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function InterchangeRing({
  position,
  reduced,
}: {
  position: THREE.Vector3;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (reduced || !ref.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.18;
    ref.current.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={position}>
      <ringGeometry args={[28, 40, 32]} />
      <meshBasicMaterial
        color="#ffffff"
        side={THREE.DoubleSide}
        transparent
        opacity={0.9}
        toneMapped={false}
      />
    </mesh>
  );
}
