// Processes the raw OSM city data (public/data/city/raw/*) into compact,
// projected, tiled JSON for the 3D world:
//   - buildings.json  (tiled, extrudable footprints + heights)
//   - water.json      (polygons)
//   - roads.json      (polylines + width by class)
//   - greenery.json   (polygons + kind)
//   - city-config.json
//
// Coordinates are baked into scene meters (X=east, Y=north) using the SAME
// equirectangular projection as utils/geo.ts, so the client just extrudes.
//
// Data (c) OpenStreetMap contributors, ODbL.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(__dirname, "../public/data/city/raw");
const OUT = resolve(__dirname, "../public/data/city");

const CENTER = { lng: 77.209, lat: 28.6139 };
const RADIUS_KM = 5;
const TILE_SIZE = 500; // meters
const D2R = Math.PI / 180;
const M_PER_DEG = 111_320;
const COS_LAT0 = Math.cos(CENTER.lat * D2R);

/** WGS84 [lng,lat] -> scene meters [x,y] (matches utils/geo.ts). */
function proj(lng, lat) {
  return [
    Math.round((lng - CENTER.lng) * COS_LAT0 * M_PER_DEG),
    Math.round((lat - CENTER.lat) * M_PER_DEG),
  ];
}

function readRaw(name) {
  try {
    return JSON.parse(readFileSync(resolve(RAW, `${name}.json`), "utf8"));
  } catch {
    console.warn(`  (no raw file for ${name}, skipping)`);
    return { elements: [] };
  }
}

/** Extract outer rings (arrays of [lng,lat]) from a way or multipolygon relation. */
function ringsFromElement(el) {
  const rings = [];
  if (el.type === "way" && Array.isArray(el.geometry)) {
    rings.push(el.geometry.map((g) => [g.lon, g.lat]));
  } else if (el.type === "relation" && Array.isArray(el.members)) {
    for (const m of el.members) {
      if ((m.role === "outer" || m.role === "") && Array.isArray(m.geometry)) {
        rings.push(m.geometry.map((g) => [g.lon, g.lat]));
      }
    }
  }
  return rings;
}

/** Project a lng/lat ring to a flat meters array, dropping tiny segments + closing dup. */
function projectRing(ring, minSeg = 1.5) {
  const flat = [];
  let px = null;
  let py = null;
  for (const [lng, lat] of ring) {
    const [x, y] = proj(lng, lat);
    if (px !== null && Math.hypot(x - px, y - py) < minSeg) continue;
    flat.push(x, y);
    px = x;
    py = y;
  }
  // Drop a closing duplicate vertex; extrusion re-closes the loop.
  if (flat.length >= 4) {
    const n = flat.length;
    if (flat[0] === flat[n - 2] && flat[1] === flat[n - 1]) flat.length = n - 2;
  }
  return flat;
}

function centroid(flat) {
  let sx = 0;
  let sy = 0;
  const n = flat.length / 2;
  for (let i = 0; i < flat.length; i += 2) {
    sx += flat[i];
    sy += flat[i + 1];
  }
  return [sx / n, sy / n];
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const BUILDING_DEFAULTS = {
  apartments: 24,
  residential: 15,
  house: 6,
  detached: 7,
  bungalow: 6,
  commercial: 20,
  retail: 12,
  office: 32,
  industrial: 12,
  warehouse: 12,
  hotel: 34,
  hospital: 28,
  school: 12,
  college: 16,
  university: 20,
  temple: 14,
  mosque: 16,
  church: 18,
  public: 16,
  government: 22,
  civic: 18,
  train_station: 14,
  yes: 12,
};

function buildingHeight(tags = {}) {
  const h = parseFloat(tags.height);
  if (!Number.isNaN(h)) return clamp(h, 3, 400);
  const lv = parseFloat(tags["building:levels"]);
  if (!Number.isNaN(lv)) return clamp(lv * 3.2, 3, 400);
  return BUILDING_DEFAULTS[tags.building] ?? 12;
}

const ROAD_WIDTH = {
  motorway: 24,
  trunk: 20,
  primary: 16,
  secondary: 12,
  tertiary: 9,
  residential: 6,
  unclassified: 6,
  living_street: 5,
  motorway_link: 10,
  trunk_link: 9,
  primary_link: 8,
  secondary_link: 7,
};

function greenKind(tags = {}) {
  if (tags.leisure === "park" || tags.leisure === "garden") return "park";
  if (tags.leisure === "pitch") return "pitch";
  if (tags.landuse === "forest" || tags.natural === "wood") return "forest";
  if (tags.landuse === "cemetery") return "cemetery";
  return "grass";
}

// --- Build each layer --------------------------------------------------------

function buildBuildings() {
  const raw = readRaw("buildings");
  const tiles = {};
  let count = 0;
  for (const el of raw.elements) {
    const tags = el.tags ?? {};
    if (tags.building === "roof") continue;
    const height = buildingHeight(tags);
    for (const ring of ringsFromElement(el)) {
      const r = projectRing(ring, 1.5);
      if (r.length < 6) continue; // need >= 3 points
      const [cx, cy] = centroid(r);
      const key = `${Math.floor(cx / TILE_SIZE)}_${Math.floor(cy / TILE_SIZE)}`;
      (tiles[key] ??= []).push({ r, h: height });
      count++;
    }
  }
  return { tiles, count };
}

function buildPolygons(name, kindFn) {
  const raw = readRaw(name);
  const out = [];
  for (const el of raw.elements) {
    const tags = el.tags ?? {};
    for (const ring of ringsFromElement(el)) {
      const r = projectRing(ring, 2);
      if (r.length < 6) continue;
      const item = { r };
      if (kindFn) item.k = kindFn(tags);
      out.push(item);
    }
  }
  return out;
}

function buildRoads() {
  const raw = readRaw("roads");
  const out = [];
  for (const el of raw.elements) {
    if (el.type !== "way" || !Array.isArray(el.geometry)) continue;
    const cls = el.tags?.highway ?? "residential";
    const p = projectRing(el.geometry.map((g) => [g.lon, g.lat]), 2.5);
    if (p.length < 4) continue;
    out.push({ p, w: ROAD_WIDTH[cls] ?? 6, c: cls });
  }
  return out;
}

function main() {
  mkdirSync(OUT, { recursive: true });

  console.log("Building buildings...");
  const buildings = buildBuildings();
  writeFileSync(
    resolve(OUT, "buildings.json"),
    JSON.stringify({ tileSize: TILE_SIZE, tiles: buildings.tiles })
  );

  console.log("Building water...");
  const water = buildPolygons("water", null);
  writeFileSync(resolve(OUT, "water.json"), JSON.stringify(water));

  console.log("Building greenery...");
  const green = buildPolygons("green", greenKind);
  writeFileSync(resolve(OUT, "greenery.json"), JSON.stringify(green));

  console.log("Building roads...");
  const roads = buildRoads();
  writeFileSync(resolve(OUT, "roads.json"), JSON.stringify(roads));

  const cfg = {
    center: [CENTER.lng, CENTER.lat],
    radiusKm: RADIUS_KM,
    tileSize: TILE_SIZE,
    generatedAt: new Date().toISOString(),
    attribution: "Data (c) OpenStreetMap contributors, ODbL",
    counts: {
      buildings: buildings.count,
      buildingTiles: Object.keys(buildings.tiles).length,
      water: water.length,
      greenery: green.length,
      roads: roads.length,
    },
  };
  writeFileSync(resolve(OUT, "city-config.json"), JSON.stringify(cfg, null, 2));

  console.log("Done. Counts:", cfg.counts);
}

main();
