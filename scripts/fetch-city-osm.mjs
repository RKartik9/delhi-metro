// Downloads raw OpenStreetMap geometry for the central Delhi core (buildings,
// water, roads, greenery) from the Overpass API and caches each category to
// public/data/city/raw/*.json.
//
// Data (c) OpenStreetMap contributors, ODbL.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/data/city/raw");

// Projection origin (must match utils/geo.ts / public/data/config.json).
const CENTER = { lng: 77.209, lat: 28.6139 };
// Core radius in km (bump/reduce to trade coverage for performance).
const RADIUS_KM = 5;

const KM_PER_DEG_LAT = 111.32;
const dLat = RADIUS_KM / KM_PER_DEG_LAT;
const dLng = dLat / Math.cos((CENTER.lat * Math.PI) / 180);
// Overpass bbox order: south, west, north, east
const BBOX = [
  (CENTER.lat - dLat).toFixed(6),
  (CENTER.lng - dLng).toFixed(6),
  (CENTER.lat + dLat).toFixed(6),
  (CENTER.lng + dLng).toFixed(6),
].join(",");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const CATEGORIES = {
  buildings: `[out:json][timeout:240];
(
  way["building"](${BBOX});
  relation["building"]["type"="multipolygon"](${BBOX});
);
out geom;`,

  water: `[out:json][timeout:180];
(
  way["natural"="water"](${BBOX});
  relation["natural"="water"]["type"="multipolygon"](${BBOX});
  way["water"](${BBOX});
  way["waterway"="riverbank"](${BBOX});
  relation["waterway"="riverbank"](${BBOX});
  way["landuse"="reservoir"](${BBOX});
);
out geom;`,

  roads: `[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|motorway_link|trunk_link|primary_link|secondary_link)$"](${BBOX});
);
out geom;`,

  green: `[out:json][timeout:180];
(
  way["leisure"~"^(park|garden|pitch|recreation_ground)$"](${BBOX});
  relation["leisure"~"^(park|garden|recreation_ground)$"]["type"="multipolygon"](${BBOX});
  way["landuse"~"^(grass|forest|meadow|recreation_ground|village_green|cemetery)$"](${BBOX});
  relation["landuse"~"^(grass|forest|meadow|recreation_ground)$"]["type"="multipolygon"](${BBOX});
  way["natural"~"^(wood|scrub|grassland)$"](${BBOX});
);
out geom;`,
};

async function fetchCategory(name, query) {
  let lastErr = null;
  for (const url of ENDPOINTS) {
    try {
      console.log(`[${name}] fetching from ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data || !Array.isArray(data.elements)) throw new Error("bad response");
      return data;
    } catch (e) {
      console.warn(`  failed: ${e.message}`);
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("all endpoints failed for " + name);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log("bbox (S,W,N,E):", BBOX);
  for (const [name, query] of Object.entries(CATEGORIES)) {
    const data = await fetchCategory(name, query);
    const out = resolve(OUT_DIR, `${name}.json`);
    writeFileSync(out, JSON.stringify(data));
    console.log(`[${name}] saved ${data.elements.length} elements -> ${out}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
