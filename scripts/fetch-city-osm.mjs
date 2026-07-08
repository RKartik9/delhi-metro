// Downloads raw OpenStreetMap geometry for the Delhi Metro city world from the
// Overpass API and caches each category to public/data/city/raw/*.json.
//
// Two tiers:
//   CORE (detailed, RADIUS_CORE_KM around Connaught Place):
//     buildings + all drivable roads + greenery
//   WIDE (full metro network extent incl. Dwarka / Noida / Gurgaon):
//     major roads + water + large green areas (no buildings; they'd be
//     sub-pixel at those camera distances and multiply the download size)
//
// Buildings/roads are fetched as a grid of tile queries so each Overpass
// request stays small enough to not time out.
//
// Data (c) OpenStreetMap contributors, ODbL.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/data/city/raw");

// Projection origin (must match utils/geo.ts / public/data/config.json).
const CENTER = { lng: 77.209, lat: 28.6139 };

/** Detailed core radius (km). */
const RADIUS_CORE_KM = 12;

/**
 * Wide tier extents in scene km relative to CENTER (X = east, Y = north).
 * Metro network spans x -28..33, y -31..15; add margin so lines never run
 * off the edge of the map.
 */
const WIDE = { minX: -33, maxX: 37, minY: -35, maxY: 19 };

const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LNG = KM_PER_DEG_LAT * Math.cos((CENTER.lat * Math.PI) / 180);

/** Scene km rect -> Overpass bbox string "S,W,N,E". */
function bboxFromKm(minX, minY, maxX, maxY) {
  return [
    (CENTER.lat + minY / KM_PER_DEG_LAT).toFixed(6),
    (CENTER.lng + minX / KM_PER_DEG_LNG).toFixed(6),
    (CENTER.lat + maxY / KM_PER_DEG_LAT).toFixed(6),
    (CENTER.lng + maxX / KM_PER_DEG_LNG).toFixed(6),
  ].join(",");
}

/** Split a scene-km rect into a grid of bboxes (tileKm-sized chunks). */
function tileBboxes(minX, minY, maxX, maxY, tileKm) {
  const boxes = [];
  for (let x = minX; x < maxX; x += tileKm) {
    for (let y = minY; y < maxY; y += tileKm) {
      boxes.push(bboxFromKm(x, y, Math.min(x + tileKm, maxX), Math.min(y + tileKm, maxY)));
    }
  }
  return boxes;
}

const CORE = {
  minX: -RADIUS_CORE_KM,
  minY: -RADIUS_CORE_KM,
  maxX: RADIUS_CORE_KM,
  maxY: RADIUS_CORE_KM,
};

const WIDE_BBOX = bboxFromKm(WIDE.minX, WIDE.minY, WIDE.maxX, WIDE.maxY);

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/**
 * Each category is a list of Overpass queries; results are merged and deduped
 * (by element type+id) into one raw file per category.
 */
const CATEGORIES = {
  buildings: tileBboxes(CORE.minX, CORE.minY, CORE.maxX, CORE.maxY, 6).map(
    (bbox) => `[out:json][timeout:300];
(
  way["building"](${bbox});
  relation["building"]["type"="multipolygon"](${bbox});
);
out geom;`
  ),

  water: [
    `[out:json][timeout:300];
(
  way["natural"="water"](${WIDE_BBOX});
  relation["natural"="water"]["type"="multipolygon"](${WIDE_BBOX});
  way["water"](${WIDE_BBOX});
  way["waterway"="riverbank"](${WIDE_BBOX});
  relation["waterway"="riverbank"](${WIDE_BBOX});
  way["landuse"="reservoir"](${WIDE_BBOX});
);
out geom;`,
  ],

  roads: [
    // Detailed roads inside the core, tiled.
    ...tileBboxes(CORE.minX, CORE.minY, CORE.maxX, CORE.maxY, 12).map(
      (bbox) => `[out:json][timeout:300];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|motorway_link|trunk_link|primary_link|secondary_link)$"](${bbox});
);
out geom;`
    ),
    // Major roads across the whole metro extent.
    `[out:json][timeout:300];
(
  way["highway"~"^(motorway|trunk|primary|secondary|motorway_link|trunk_link|primary_link|secondary_link)$"](${WIDE_BBOX});
);
out geom;`,
  ],

  green: [
    // Full greenery detail inside the core.
    `[out:json][timeout:300];
(
  way["leisure"~"^(park|garden|pitch|recreation_ground)$"](${bboxFromKm(
    CORE.minX,
    CORE.minY,
    CORE.maxX,
    CORE.maxY
  )});
  relation["leisure"~"^(park|garden|recreation_ground)$"]["type"="multipolygon"](${bboxFromKm(
    CORE.minX,
    CORE.minY,
    CORE.maxX,
    CORE.maxY
  )});
  way["landuse"~"^(grass|forest|meadow|recreation_ground|village_green|cemetery)$"](${bboxFromKm(
    CORE.minX,
    CORE.minY,
    CORE.maxX,
    CORE.maxY
  )});
  relation["landuse"~"^(grass|forest|meadow|recreation_ground)$"]["type"="multipolygon"](${bboxFromKm(
    CORE.minX,
    CORE.minY,
    CORE.maxX,
    CORE.maxY
  )});
  way["natural"~"^(wood|scrub|grassland)$"](${bboxFromKm(
    CORE.minX,
    CORE.minY,
    CORE.maxX,
    CORE.maxY
  )});
);
out geom;`,
    // Only substantial green areas in the wide tier.
    `[out:json][timeout:300];
(
  way["leisure"~"^(park|garden|nature_reserve|recreation_ground)$"](${WIDE_BBOX});
  relation["leisure"~"^(park|garden|nature_reserve|recreation_ground)$"]["type"="multipolygon"](${WIDE_BBOX});
  way["landuse"="forest"](${WIDE_BBOX});
  relation["landuse"="forest"]["type"="multipolygon"](${WIDE_BBOX});
  way["natural"="wood"](${WIDE_BBOX});
  relation["natural"="wood"]["type"="multipolygon"](${WIDE_BBOX});
);
out geom;`,
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Endpoint stickiness: once one works, keep using it instead of re-probing
// endpoints that 406/429 on every tile.
let preferredEndpoint = null;

async function fetchQuery(label, query) {
  let lastErr = null;
  const order = preferredEndpoint
    ? [preferredEndpoint, ...ENDPOINTS.filter((u) => u !== preferredEndpoint)]
    : ENDPOINTS;
  for (const url of order) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[${label}] fetching from ${url} (attempt ${attempt})`);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "delhi-metro-3d/0.1 (city data build script)",
          },
          body: "data=" + encodeURIComponent(query),
          signal: AbortSignal.timeout(240_000),
        });
        if (res.status === 429 || res.status === 504) {
          console.warn(`  HTTP ${res.status}, backing off 10s`);
          await sleep(10_000);
          throw new Error("HTTP " + res.status);
        }
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (!data || !Array.isArray(data.elements)) throw new Error("bad response");
        preferredEndpoint = url;
        return data;
      } catch (e) {
        console.warn(`  failed: ${e.message}`);
        lastErr = e;
      }
    }
  }
  throw lastErr ?? new Error("all endpoints failed for " + label);
}

async function fetchCategory(name, queries) {
  const partsDir = resolve(OUT_DIR, "parts");
  mkdirSync(partsDir, { recursive: true });
  const byId = new Map();
  for (let i = 0; i < queries.length; i++) {
    const label = queries.length > 1 ? `${name} ${i + 1}/${queries.length}` : name;
    const partFile = resolve(partsDir, `${name}_${i}.json`);
    let data;
    if (existsSync(partFile)) {
      data = JSON.parse(readFileSync(partFile, "utf8"));
      console.log(`[${label}] cached (${data.elements.length} elements)`);
    } else {
      data = await fetchQuery(label, queries[i]);
      writeFileSync(partFile, JSON.stringify(data));
      // Be polite to the public Overpass instances.
      if (i < queries.length - 1) await sleep(2_000);
    }
    for (const el of data.elements) byId.set(`${el.type}/${el.id}`, el);
    console.log(`[${label}] +${data.elements.length} elements (total unique ${byId.size})`);
  }
  return { elements: [...byId.values()] };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log("core bbox (S,W,N,E):", bboxFromKm(CORE.minX, CORE.minY, CORE.maxX, CORE.maxY));
  console.log("wide bbox (S,W,N,E):", WIDE_BBOX);
  for (const [name, queries] of Object.entries(CATEGORIES)) {
    const data = await fetchCategory(name, queries);
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
