// Shared CatmullRom curve construction for metro lines so that the rendered tube
// (MetroLine), the trains that ride it, and the viaduct pillars all use the exact
// same geometry. Lines follow the real layout: elevated sections ride high on a
// viaduct, at-grade sections hug the ground, underground sections drop below it.
import * as THREE from "three";
import { project, projectToVector3 } from "@/utils/geo";
import type { MetroData, MetroLine, StationLayout } from "@/types/metro";

/** Deck/track height (meters) for each station layout. */
export const LAYOUT_HEIGHT: Record<StationLayout, number> = {
  Elevated: 12,
  "At Grade": 2.5,
  Underground: -9,
};

/** Per-line vertical stagger to reduce z-fighting where parallel lines overlap. */
export const LINE_STAGGER = 0.7;
/** Tube radius (meters; roughly a viaduct half-width). */
export const LINE_RADIUS = 5;
/** Height of the always-visible ground-level route trace (meters). */
export const TRACE_Z = 1.4;
/** A curve point above this height is considered "elevated" (needs pillars). */
export const ELEVATED_THRESHOLD = 6;

export function layoutHeight(layout: StationLayout): number {
  return LAYOUT_HEIGHT[layout] ?? LAYOUT_HEIGHT.Elevated;
}

/** Per-control-point heights derived from the nearest station's layout. */
function controlHeights(line: MetroLine, data: MetroData, index: number): number[] {
  const stations = line.stationIds
    .map((id) => data.stationsById[id])
    .filter(Boolean);
  const stagger = index * LINE_STAGGER;
  return line.controlPoints.map((cp) => {
    const [cx, cy] = project(cp[0], cp[1]);
    let best = Infinity;
    let layout: StationLayout = "Elevated";
    for (const s of stations) {
      const dx = s.position[0] - cx;
      const dy = s.position[1] - cy;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        layout = s.layout;
      }
    }
    return layoutHeight(layout) + stagger;
  });
}

const curveCache = new Map<string, THREE.CatmullRomCurve3>();
const traceCache = new Map<string, THREE.CatmullRomCurve3>();

/**
 * Cached CatmullRom curve for a line, following its layout-based height profile.
 * Cached by line id (heights are stable per line).
 */
export function getLineCurve(
  line: MetroLine,
  data: MetroData,
  index: number
): THREE.CatmullRomCurve3 {
  const cached = curveCache.get(line.id);
  if (cached) return cached;
  const heights = controlHeights(line, data, index);
  const pts = line.controlPoints.map((cp, i) => projectToVector3(cp, heights[i]));
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  curveCache.set(line.id, curve);
  return curve;
}

/** Cached flat ground-level trace curve (keeps every line legible from above). */
export function getLineTraceCurve(line: MetroLine): THREE.CatmullRomCurve3 {
  const cached = traceCache.get(line.id);
  if (cached) return cached;
  const pts = line.controlPoints.map((cp) => projectToVector3(cp, TRACE_Z));
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  traceCache.set(line.id, curve);
  return curve;
}
