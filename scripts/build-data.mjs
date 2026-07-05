// Builds the production Delhi Metro dataset from the cached OSM data.
//
// Inputs : public/data/raw/osm.json  (from fetch-osm.mjs)
// Outputs: public/data/{stations.geojson, metro-lines.geojson, routes.json,
//          graph.json, interchanges.json, colors.json, train-paths.json,
//          config.json}
//
// Data (c) OpenStreetMap contributors, ODbL. Station ordering and geometry are
// taken directly from OSM route relations (no invented ordering or coordinates).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../public/data");
const raw = JSON.parse(readFileSync(resolve(DATA_DIR, "raw/osm.json"), "utf8"));

// --- Canonical line configuration -------------------------------------------
// One "forward" relation per line. Official DMRC line colours. Reverse-direction
// relations and the disconnected Phase-4 (Majlis Park -> Deepali Chowk, ref 8)
// corridor are intentionally excluded.
const LINE_CONFIG = [
  { relId: 447214, id: "red-line", name: "Red Line", color: "#E31E24" },
  { relId: 447210, id: "yellow-line", name: "Yellow Line", color: "#FFD200" },
  { relId: 8037669, id: "blue-line", name: "Blue Line", color: "#0072CE" },
  { relId: 2535795, id: "blue-line-branch", name: "Blue Line Branch", color: "#0072CE" },
  { relId: 8037666, id: "green-line", name: "Green Line", color: "#00A651" },
  { relId: 2535796, id: "green-line-branch", name: "Green Line Branch", color: "#00A651" },
  { relId: 2535797, id: "violet-line", name: "Violet Line", color: "#8E44AD" },
  { relId: 8241298, id: "pink-line", name: "Pink Line", color: "#FF69B4" },
  { relId: 8385429, id: "magenta-line", name: "Magenta Line", color: "#D6007F" },
  { relId: 3537978, id: "grey-line", name: "Grey Line", color: "#808080" },
  { relId: 8037715, id: "airport-express", name: "Airport Express", color: "#F7941D" },
  { relId: 9268569, id: "aqua-line", name: "Aqua Line", color: "#00B9F1" },
  { relId: 4481323, id: "rapid-metro", name: "Rapid Metro Gurgaon", color: "#E4002B" },
];

// --- Index raw elements ------------------------------------------------------
const nodeById = new Map();
const wayById = new Map();
const relById = new Map();
for (const e of raw.elements) {
  if (e.type === "node") nodeById.set(e.id, e);
  else if (e.type === "way") wayById.set(e.id, e);
  else if (e.type === "relation") relById.set(e.id, e);
}

// --- Helpers -----------------------------------------------------------------
function cleanName(name) {
  let s = name.replace(/\s*\((?:[^()]*\bLine)\)\s*$/i, ""); // drop "(X Line)" suffix
  s = s.replace(/[\u2013\u2014]/g, "-"); // en/em dash -> hyphen
  s = s.replace(/\s*-\s*/g, " - "); // normalise spacing around hyphens
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isStation(n) {
  if (!n || !n.tags) return false;
  const t = n.tags;
  return (
    !!t.name &&
    (t.railway === "station" ||
      t.railway === "halt" ||
      t.public_transport === "station" ||
      t.public_transport === "stop_position" ||
      t.station === "subway")
  );
}

function wayLayout(way) {
  const t = way.tags || {};
  const layer = t.layer !== undefined ? parseInt(t.layer, 10) : NaN;
  if (t.tunnel && t.tunnel !== "no") return "Underground";
  if (t.bridge && t.bridge !== "no") return "Elevated";
  if (!Number.isNaN(layer) && layer < 0) return "Underground";
  if (!Number.isNaN(layer) && layer > 0) return "Elevated";
  return "At Grade";
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// Ordered station stop nodes for a relation (deduped consecutively + globally).
function orderedStops(rel) {
  const seq = [];
  let last = null;
  for (const m of rel.members) {
    if (m.type !== "node") continue;
    if (!/stop|station|platform/.test(m.role || "")) continue;
    const n = nodeById.get(m.ref);
    if (!isStation(n)) continue;
    if (n.tags.name === last) continue;
    seq.push(n);
    last = n.tags.name;
  }
  // Drop non-consecutive duplicates (keep first) e.g. Pink near-ring, Rapid loop.
  const seen = new Set();
  return seq.filter((n) => {
    const key = cleanName(n.tags.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Stitch ordered way members into a single polyline of [lng,lat] with a parallel
// layout classification per vertex.
function stitchGeometry(rel) {
  const ways = [];
  for (const m of rel.members) {
    if (m.type !== "way") continue;
    const w = wayById.get(m.ref);
    if (!w || !Array.isArray(w.geometry) || w.geometry.length < 2) continue;
    ways.push(w);
  }
  if (ways.length === 0) return { coords: [], layouts: [] };

  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const coords = [];
  const layouts = [];
  const pushWay = (w, reversed) => {
    const lay = wayLayout(w);
    const pts = w.geometry.map((g) => [g.lon, g.lat]);
    if (reversed) pts.reverse();
    for (const p of pts) {
      const lastP = coords[coords.length - 1];
      if (lastP && dist2(lastP, p) < 1e-12) continue; // skip duplicate joint
      coords.push(p);
      layouts.push(lay);
    }
  };

  // First way: orient so its far end continues toward the second way.
  let first = ways[0];
  if (ways[1]) {
    const a = [first.geometry[0].lon, first.geometry[0].lat];
    const b = [first.geometry[first.geometry.length - 1].lon, first.geometry[first.geometry.length - 1].lat];
    const nx = ways[1].geometry.map((g) => [g.lon, g.lat]);
    const nEnds = [nx[0], nx[nx.length - 1]];
    const aMin = Math.min(...nEnds.map((e) => dist2(a, e)));
    const bMin = Math.min(...nEnds.map((e) => dist2(b, e)));
    pushWay(first, aMin < bMin); // reverse if start is the connecting end
  } else {
    pushWay(first, false);
  }
  for (let i = 1; i < ways.length; i++) {
    const w = ways[i];
    const start = [w.geometry[0].lon, w.geometry[0].lat];
    const end = [w.geometry[w.geometry.length - 1].lon, w.geometry[w.geometry.length - 1].lat];
    const tail = coords[coords.length - 1];
    pushWay(w, dist2(tail, end) < dist2(tail, start));
  }
  return { coords, layouts };
}

function nearestLayout(coord, geom) {
  let best = "At Grade";
  let bestD = Infinity;
  for (let i = 0; i < geom.coords.length; i++) {
    const d = (geom.coords[i][0] - coord[0]) ** 2 + (geom.coords[i][1] - coord[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = geom.layouts[i];
    }
  }
  return best;
}

// Downsample a polyline to at most `max` control points (keeps first + last).
function downsample(coords, max) {
  if (coords.length <= max) return coords.map((c) => [round6(c[0]), round6(c[1])]);
  const step = (coords.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(coords[Math.round(i * step)]);
  return out.map((c) => [round6(c[0]), round6(c[1])]);
}

// --- Build -------------------------------------------------------------------
const stations = new Map(); // cleanName -> { id, name, lines:Set, lats:[], lngs:[], layouts:[] }
const routes = {};
const lineGeom = {}; // lineName -> { coords, layouts }
const colors = {};
const lines = [];

for (const cfg of LINE_CONFIG) {
  const rel = relById.get(cfg.relId);
  if (!rel) {
    console.warn(`WARN: relation ${cfg.relId} (${cfg.name}) not found; skipping`);
    continue;
  }
  const stops = orderedStops(rel);
  const geom = stitchGeometry(rel);
  lineGeom[cfg.name] = geom;
  colors[cfg.name] = cfg.color;
  routes[cfg.name] = [];

  for (const n of stops) {
    const name = cleanName(n.tags.name);
    routes[cfg.name].push(name);
    let st = stations.get(name);
    if (!st) {
      st = { id: slug(name), name, lines: new Set(), lats: [], lngs: [], layouts: [] };
      stations.set(name, st);
    }
    st.lines.add(cfg.name);
    st.lats.push(n.lat);
    st.lngs.push(n.lon);
    st.layouts.push(nearestLayout([n.lon, n.lat], geom));
  }

  lines.push({ ...cfg, stationCount: stops.length });
}

// Resolve one layout + coordinate per station.
function mode(arr) {
  const rank = { Underground: 3, Elevated: 2, "At Grade": 1 };
  const counts = {};
  for (const a of arr) counts[a] = (counts[a] || 0) + 1;
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || rank[b] - rank[a])[0];
}

const stationList = [];
for (const st of stations.values()) {
  const lng = round6(st.lngs.reduce((a, b) => a + b, 0) / st.lngs.length);
  const lat = round6(st.lats.reduce((a, b) => a + b, 0) / st.lats.length);
  stationList.push({
    id: st.id,
    name: st.name,
    lines: [...st.lines],
    layout: mode(st.layouts),
    interchange: st.lines.size > 1,
    lng,
    lat,
  });
}
stationList.sort((a, b) => a.name.localeCompare(b.name));

// Ensure unique ids (append suffix on collision from different names).
const idCount = {};
for (const s of stationList) {
  if (idCount[s.id]) {
    idCount[s.id]++;
    s.id = `${s.id}-${idCount[s.id]}`;
  } else idCount[s.id] = 1;
}
const idByName = new Map(stationList.map((s) => [s.name, s.id]));

// --- stations.geojson --------------------------------------------------------
const stationsGeojson = {
  type: "FeatureCollection",
  features: stationList.map((s) => ({
    type: "Feature",
    properties: {
      id: s.id,
      name: s.name,
      lines: s.lines,
      layout: s.layout,
      interchange: s.interchange,
    },
    geometry: { type: "Point", coordinates: [s.lng, s.lat] },
  })),
};

// --- metro-lines.geojson -----------------------------------------------------
const metroLinesGeojson = {
  type: "FeatureCollection",
  features: lines
    .filter((l) => lineGeom[l.name].coords.length >= 2)
    .map((l) => ({
      type: "Feature",
      properties: { id: l.id, name: l.name, color: l.color },
      geometry: {
        type: "LineString",
        coordinates: lineGeom[l.name].coords.map((c) => [round6(c[0]), round6(c[1])]),
      },
    })),
};

// --- graph.json --------------------------------------------------------------
const adj = new Map();
const addEdge = (a, b) => {
  if (a === b) return;
  if (!adj.has(a)) adj.set(a, new Set());
  adj.get(a).add(b);
};
for (const seq of Object.values(routes)) {
  for (let i = 0; i < seq.length - 1; i++) {
    addEdge(seq[i], seq[i + 1]);
    addEdge(seq[i + 1], seq[i]);
  }
}
const graph = {};
for (const name of [...adj.keys()].sort()) graph[name] = [...adj.get(name)].sort();

// --- interchanges.json -------------------------------------------------------
const interchanges = stationList
  .filter((s) => s.interchange)
  .map((s) => ({ name: s.name, id: s.id, lines: s.lines }));

// --- train-paths.json --------------------------------------------------------
const trainPaths = {};
for (const l of lines) {
  const g = lineGeom[l.name].coords;
  if (g.length >= 2) trainPaths[l.name] = downsample(g, 80);
}

// --- config.json -------------------------------------------------------------
const config = {
  coordinateSystem: "WGS84",
  defaultCenter: [77.209, 28.6139],
  defaultZoom: 120,
  scale: 15000,
  version: "1.0",
  attribution: "Data (c) OpenStreetMap contributors, ODbL",
  generatedAt: new Date().toISOString(),
  counts: {
    lines: metroLinesGeojson.features.length,
    stations: stationList.length,
    interchanges: interchanges.length,
  },
};

// --- Write -------------------------------------------------------------------
const write = (file, obj) =>
  writeFileSync(resolve(DATA_DIR, file), JSON.stringify(obj, null, 2));
write("stations.geojson", stationsGeojson);
write("metro-lines.geojson", metroLinesGeojson);
write("routes.json", routes);
write("graph.json", graph);
write("interchanges.json", interchanges);
write("colors.json", colors);
write("train-paths.json", trainPaths);
write("config.json", config);

console.log("Wrote dataset:");
console.log("  lines        :", metroLinesGeojson.features.length);
console.log("  stations     :", stationList.length);
console.log("  interchanges :", interchanges.length);
console.log("  graph nodes  :", Object.keys(graph).length);
for (const l of lines)
  console.log(
    `   - ${l.name.padEnd(20)} stops=${String(routes[l.name].length).padStart(3)} pathPts=${lineGeom[l.name].coords.length}`
  );
