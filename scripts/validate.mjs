// Validates the generated dataset against the requirements in
// generate-metro-data.md and cursor-rules.md.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../public/data");
const load = (f) => JSON.parse(readFileSync(resolve(DATA_DIR, f), "utf8"));

const stations = load("stations.geojson");
const metroLines = load("metro-lines.geojson");
const routes = load("routes.json");
const graph = load("graph.json");
const interchanges = load("interchanges.json");
const colors = load("colors.json");
const trainPaths = load("train-paths.json");
const config = load("config.json");

let errors = 0;
let warnings = 0;
const fail = (m) => {
  errors++;
  console.error("  FAIL:", m);
};
const warn = (m) => {
  warnings++;
  console.warn("  warn:", m);
};

// Delhi NCR bounding box (with margin for Meerut-free NCR extent).
const BBOX = { minLng: 76.7, maxLng: 77.8, minLat: 28.2, maxLat: 29.0 };

// --- 1. Valid GeoJSON (RFC 7946) --------------------------------------------
console.log("[1] GeoJSON structure (RFC 7946)");
function checkFC(fc, geomType, label) {
  if (fc.type !== "FeatureCollection") fail(`${label}: type != FeatureCollection`);
  if (!Array.isArray(fc.features)) return fail(`${label}: features not array`);
  for (const f of fc.features) {
    if (f.type !== "Feature") fail(`${label}: feature.type != Feature`);
    if (!f.geometry || f.geometry.type !== geomType)
      fail(`${label}: bad geometry type for ${f.properties?.name}`);
    const c = f.geometry?.coordinates;
    if (geomType === "Point") {
      if (!Array.isArray(c) || c.length !== 2 || c.some((x) => typeof x !== "number"))
        fail(`${label}: bad Point coords for ${f.properties?.name}`);
    } else if (geomType === "LineString") {
      if (!Array.isArray(c) || c.length < 2)
        fail(`${label}: LineString needs >= 2 positions (${f.properties?.name})`);
      for (const p of c)
        if (!Array.isArray(p) || p.length !== 2 || p.some((x) => typeof x !== "number"))
          fail(`${label}: bad position in ${f.properties?.name}`);
    }
  }
}
checkFC(stations, "Point", "stations.geojson");
checkFC(metroLines, "LineString", "metro-lines.geojson");

// --- 2. Coordinates: order [lng,lat] within Delhi NCR, WGS84 -----------------
console.log("[2] Coordinate sanity (WGS84, [lng,lat], within NCR)");
for (const f of stations.features) {
  const [lng, lat] = f.geometry.coordinates;
  if (lng < BBOX.minLng || lng > BBOX.maxLng || lat < BBOX.minLat || lat > BBOX.maxLat)
    fail(`station ${f.properties.name} out of NCR bbox: [${lng}, ${lat}]`);
}

// --- 3. Every station exists exactly once (unique id + unique name) ---------
console.log("[3] Station uniqueness");
const ids = new Set();
const names = new Set();
for (const f of stations.features) {
  const { id, name } = f.properties;
  if (ids.has(id)) fail(`duplicate id: ${id}`);
  if (names.has(name)) fail(`duplicate name: ${name}`);
  ids.add(id);
  names.add(name);
}

// --- 4. No duplicate coordinates --------------------------------------------
console.log("[4] No duplicate coordinates");
const coordSeen = new Map();
for (const f of stations.features) {
  const key = f.geometry.coordinates.join(",");
  if (coordSeen.has(key)) warn(`duplicate coords ${key}: ${coordSeen.get(key)} & ${f.properties.name}`);
  else coordSeen.set(key, f.properties.name);
}

// --- 5. Interchange detection ------------------------------------------------
console.log("[5] Interchange detection");
for (const f of stations.features) {
  const expected = f.properties.lines.length > 1;
  if (f.properties.interchange !== expected)
    fail(`interchange flag wrong for ${f.properties.name}`);
}
const ixNames = new Set(interchanges.map((i) => i.name));
for (const f of stations.features)
  if (f.properties.interchange && !ixNames.has(f.properties.name))
    fail(`missing from interchanges.json: ${f.properties.name}`);

// --- 6. Routes reference known stations; lines continuous in graph ----------
console.log("[6] Route integrity + line continuity");
for (const [line, seq] of Object.entries(routes)) {
  if (seq.length < 2) fail(`route ${line} has < 2 stations`);
  const dup = seq.filter((s, i) => seq.indexOf(s) !== i);
  if (dup.length) fail(`route ${line} has duplicate stations: ${[...new Set(dup)].join(", ")}`);
  for (const s of seq) if (!names.has(s)) fail(`route ${line}: unknown station "${s}"`);
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i];
    const b = seq[i + 1];
    if (!graph[a] || !graph[a].includes(b))
      fail(`discontinuity in ${line}: ${a} !-> ${b}`);
  }
}

// --- 7. Graph symmetry + connectivity ---------------------------------------
console.log("[7] Graph symmetry + connectivity");
for (const [a, nbrs] of Object.entries(graph))
  for (const b of nbrs)
    if (!graph[b] || !graph[b].includes(a)) fail(`asymmetric edge ${a} -> ${b}`);
// BFS reachability across whole network (should be one component; branches join).
const start = Object.keys(graph)[0];
const visited = new Set([start]);
const queue = [start];
while (queue.length) {
  const cur = queue.shift();
  for (const n of graph[cur]) if (!visited.has(n)) (visited.add(n), queue.push(n));
}
if (visited.size !== Object.keys(graph).length)
  warn(`graph not fully connected: ${visited.size}/${Object.keys(graph).length} reachable (isolated networks e.g. Aqua/Rapid are expected)`);

// --- 8. Colours are valid hex + present for every line ----------------------
console.log("[8] Colours");
for (const f of metroLines.features) {
  const c = colors[f.properties.name];
  if (!c) fail(`missing colour for ${f.properties.name}`);
  else if (!/^#[0-9a-fA-F]{6}$/.test(c)) fail(`invalid hex colour ${c} for ${f.properties.name}`);
  if (c && c.toLowerCase() !== f.properties.color.toLowerCase())
    fail(`colour mismatch for ${f.properties.name}: ${c} vs ${f.properties.color}`);
}

// --- 9. train-paths present per line ----------------------------------------
console.log("[9] Train paths");
for (const f of metroLines.features) {
  const p = trainPaths[f.properties.name];
  if (!p || p.length < 2) fail(`train path missing/short for ${f.properties.name}`);
}

// --- 10. config sanity -------------------------------------------------------
console.log("[10] Config");
if (config.coordinateSystem !== "WGS84") fail("config.coordinateSystem != WGS84");
if (config.counts.stations !== stations.features.length) fail("config station count mismatch");
if (config.counts.lines !== metroLines.features.length) fail("config line count mismatch");

console.log(`\nSummary: ${stations.features.length} stations, ${metroLines.features.length} lines, ${interchanges.length} interchanges`);
console.log(`Errors: ${errors} | Warnings: ${warnings}`);
process.exit(errors ? 1 : 0);
