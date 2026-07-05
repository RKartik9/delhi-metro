"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import {
  getLineCurve,
  getLineTraceCurve,
  LINE_RADIUS,
} from "@/utils/lineCurve";
import { useMetroStore } from "@/stores/useMetroStore";
import type { MetroLine as MetroLineModel } from "@/types/metro";

interface MetroLineProps {
  line: MetroLineModel;
  index: number;
}

/**
 * Renders a single metro line as a smooth tube following a CatmullRom spline
 * through the line's control points, in its official colour. Handles hover /
 * click selection with highlight (glow), thickness bump, and dimming of others.
 */
export default function MetroLine({ line, index }: MetroLineProps) {
  const data = useMetroStore((s) => s.data);
  const hidden = useMetroStore((s) => s.hiddenLineIds.has(line.id));
  const isSelected = useMetroStore((s) => s.selectedLineId === line.id);
  const isHovered = useMetroStore((s) => s.hoveredLineId === line.id);
  const anySelected = useMetroStore((s) => s.selectedLineId !== null);
  const route = useMetroStore((s) => s.route);
  const selectLine = useMetroStore((s) => s.selectLine);
  const hoverLine = useMetroStore((s) => s.hoverLine);

  const inRoute = route
    ? route.segments.some((seg) => seg.lineId === line.id)
    : false;
  const routeActive = route !== null;

  const active = isSelected || isHovered || (routeActive && inRoute);
  const dim = (anySelected && !isSelected) || (routeActive && !inRoute);

  const curve = useMemo(
    () => (data ? getLineCurve(line, data, index) : null),
    [line, data, index]
  );
  const traceCurve = useMemo(() => getLineTraceCurve(line), [line]);

  const tubularSegments = useMemo(
    () => Math.max(64, line.controlPoints.length * 8),
    [line.controlPoints.length]
  );

  // A larger, additive glow tube is only built while the line is active.
  const glowGeometry = useMemo(() => {
    if (!active || !curve) return null;
    return new THREE.TubeGeometry(
      curve,
      Math.min(tubularSegments, 400),
      LINE_RADIUS * 2.6,
      8,
      false
    );
  }, [active, curve, tubularSegments]);

  useEffect(() => () => glowGeometry?.dispose(), [glowGeometry]);

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hoverLine(line.id);
    document.body.style.cursor = "pointer";
  };
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hoverLine(null);
    document.body.style.cursor = "auto";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectLine(useMetroStore.getState().selectedLineId === line.id ? null : line.id);
  };

  if (hidden || !curve) return null;

  const traceSegments = Math.min(tubularSegments, 400);

  return (
    <group>
      {/* Main track tube, riding the layout height profile (viaduct/tunnel). */}
      <mesh
        castShadow
        receiveShadow
        onPointerOver={onOver}
        onPointerOut={onOut}
        onClick={onClick}
      >
        <tubeGeometry args={[curve, tubularSegments, LINE_RADIUS, 8, false]} />
        <meshStandardMaterial
          color={line.color}
          emissive={line.color}
          emissiveIntensity={active ? 0.9 : dim ? 0.08 : 0.35}
          roughness={0.55}
          metalness={0.1}
          transparent={dim}
          opacity={dim ? 0.5 : 1}
        />
      </mesh>

      {/* Always-visible ground trace so underground lines stay legible. */}
      <mesh>
        <tubeGeometry args={[traceCurve, traceSegments, 2.2, 6, false]} />
        <meshBasicMaterial
          color={line.color}
          transparent
          opacity={dim ? 0.12 : active ? 0.5 : 0.3}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {glowGeometry && (
        <mesh geometry={glowGeometry}>
          <meshBasicMaterial
            color={line.color}
            transparent
            opacity={0.18}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}
