import type { CityData } from "@/types/city";
import type { MetroData } from "@/types/metro";
import { nudgeOutOfBuildings } from "./buildingCollision";

/**
 * Radius (meters, from the scene origin at Connaught Place) inside which
 * buildings are real extruded footprints (scripts/build-city.mjs
 * DETAIL_RADIUS). Beyond it the city is instanced boxes, so street view is
 * only offered inside this zone.
 */
export const DETAIL_RADIUS_M = 6_000;

/** Station the street view drops into by default. */
export const DEFAULT_STREET_STATION_ID = "rajiv-chowk";

export interface StreetSpawn {
  x: number;
  y: number;
  /** Heading in radians (0 = east, pi/2 = north). */
  yaw: number;
}

export function isInDetailZone(x: number, y: number): boolean {
  return Math.hypot(x, y) <= DETAIL_RADIUS_M;
}

/**
 * Nearest point on any road centreline within `maxDist` meters of (x, y).
 * Linear scan over segments (only runs on enter / click, not per frame).
 * Also returns the road heading at that point so we can face along it.
 */
export function nearestRoadPoint(
  city: CityData,
  x: number,
  y: number,
  maxDist = 120
): { x: number; y: number; heading: number } | null {
  let best = maxDist * maxDist;
  let bx = 0;
  let by = 0;
  let heading = 0;
  let found = false;
  const reach = maxDist * 1.5;

  for (const road of city.roads) {
    const p = road.p;
    const n = p.length / 2;
    if (n < 2) continue;

    for (let i = 0; i < n - 1; i++) {
      const ax = p[i * 2];
      const ay = p[i * 2 + 1];
      const cx = p[(i + 1) * 2];
      const cy = p[(i + 1) * 2 + 1];
      if (
        Math.min(ax, cx) - reach > x ||
        Math.max(ax, cx) + reach < x ||
        Math.min(ay, cy) - reach > y ||
        Math.max(ay, cy) + reach < y
      ) {
        continue;
      }
      const dx = cx - ax;
      const dy = cy - ay;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((x - ax) * dx + (y - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t;
      const py = ay + dy * t;
      const d2 = (px - x) * (px - x) + (py - y) * (py - y);
      if (d2 < best) {
        best = d2;
        bx = px;
        by = py;
        heading = Math.atan2(dy, dx);
        found = true;
      }
    }
  }
  return found ? { x: bx, y: by, heading } : null;
}

/**
 * Turn a requested drop-in point into a safe street spawn: snap to the
 * nearest road, make sure we are not standing inside a building, and face
 * toward `lookAt` (or along the road when no target is given).
 */
export function resolveStreetSpawn(
  city: CityData | null,
  x: number,
  y: number,
  lookAt?: [number, number],
  yawOverride?: number
): StreetSpawn {
  let sx = x;
  let sy = y;
  let roadHeading: number | null = null;

  if (city) {
    const road = nearestRoadPoint(city, x, y);
    if (road) {
      sx = road.x;
      sy = road.y;
      roadHeading = road.heading;
    }
    [sx, sy] = nudgeOutOfBuildings(city, sx, sy);
  }

  let yaw: number;
  if (yawOverride != null) {
    yaw = yawOverride;
  } else if (lookAt && Math.hypot(lookAt[0] - sx, lookAt[1] - sy) > 4) {
    yaw = Math.atan2(lookAt[1] - sy, lookAt[0] - sx);
  } else if (roadHeading != null) {
    yaw = roadHeading;
  } else {
    yaw = Math.PI / 2;
  }
  return { x: sx, y: sy, yaw };
}

/**
 * Default entry point: the current map focus when it lies in the detailed
 * core, otherwise Rajiv Chowk (Connaught Place).
 */
export function defaultStreetSpawn(
  city: CityData | null,
  data: MetroData | null,
  focus?: [number, number] | null
): StreetSpawn {
  if (focus && isInDetailZone(focus[0], focus[1])) {
    return resolveStreetSpawn(city, focus[0], focus[1]);
  }
  const station = data?.stationsById[DEFAULT_STREET_STATION_ID];
  if (station) {
    const [x, y] = station.position;
    // Stand a little off the entrance headhouse and look back at it.
    return resolveStreetSpawn(city, x + 30, y - 30, [x, y]);
  }
  return resolveStreetSpawn(city, 0, 0);
}
