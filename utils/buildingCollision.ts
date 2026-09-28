import type { CityData } from "@/types/city";

/**
 * Cheap walk-collision against extruded building footprints.
 *
 * Buildings inside the detail radius are stored per ~500 m tile keyed by the
 * footprint centroid (`floor(cx/size)_floor(cy/size)`, see
 * scripts/build-city.mjs). A footprint can spill into a neighbouring tile, so
 * we always test the 3x3 neighbourhood around the query point.
 */

/** Ray-casting point-in-polygon for a flat ring [x0,y0,x1,y1,...]. */
function pointInRing(r: number[], x: number, y: number): boolean {
  let inside = false;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = r[i * 2];
    const yi = r[i * 2 + 1];
    const xj = r[j * 2];
    const yj = r[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** True when (x, y) lies inside any building footprint. */
export function isInsideBuilding(city: CityData, x: number, y: number): boolean {
  const size = city.buildings.tileSize;
  const tx = Math.floor(x / size);
  const ty = Math.floor(y / size);
  const tiles = city.buildings.tiles;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const items = tiles[`${tx + dx}_${ty + dy}`];
      if (!items) continue;
      for (const item of items) {
        if (pointInRing(item.r, x, y)) return true;
      }
    }
  }
  return false;
}

/** Probe offsets (meters) so the near plane never pokes through a wall. */
const PROBE = 0.6;
const PROBES: [number, number][] = [
  [0, 0],
  [PROBE, 0],
  [-PROBE, 0],
  [0, PROBE],
  [0, -PROBE],
];

/** True when a small disc around (x, y) is clear of buildings. */
export function isWalkable(city: CityData, x: number, y: number): boolean {
  for (const [ox, oy] of PROBES) {
    if (isInsideBuilding(city, x + ox, y + oy)) return false;
  }
  return true;
}

/**
 * Resolve a move from (x, y) to (nx, ny): returns the full move when clear,
 * otherwise slides along whichever axis is free, otherwise stays put.
 */
export function resolveMove(
  city: CityData | null,
  x: number,
  y: number,
  nx: number,
  ny: number
): [number, number] {
  if (!city) return [nx, ny];
  if (isWalkable(city, nx, ny)) return [nx, ny];
  if (isWalkable(city, nx, y)) return [nx, y];
  if (isWalkable(city, x, ny)) return [x, ny];
  return [x, y];
}

/**
 * Push a point out of a building by spiralling outward until a walkable spot
 * is found (used for spawn points). Returns the input when already clear.
 */
export function nudgeOutOfBuildings(
  city: CityData,
  x: number,
  y: number,
  maxRadius = 80
): [number, number] {
  if (isWalkable(city, x, y)) return [x, y];
  for (let r = 3; r <= maxRadius; r += 3) {
    const steps = Math.max(8, Math.round((2 * Math.PI * r) / 3));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (isWalkable(city, px, py)) return [px, py];
    }
  }
  return [x, y];
}
