// Downloads full Delhi Metro (+ Rapid Metro Gurgaon + Noida Aqua) subway route
// relations from the OpenStreetMap Overpass API, including ordered members and
// geometry, and caches the raw response to public/data/raw/osm.json.
//
// Data (c) OpenStreetMap contributors, ODbL.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/data/raw/osm.json");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const QUERY = `[out:json][timeout:300];
(
  rel["route"="subway"]["network"="Delhi Metro"];
  rel["route"="subway"]["network"="Rapid Metro Gurgaon"];
  rel["route"="subway"]["network"="Noida Metro"];
)->.r;
.r out body;
node(r.r)->.n;
.n out body;
way(r.r)->.w;
.w out body geom;`;

async function main() {
  let data = null;
  let lastErr = null;
  for (const url of ENDPOINTS) {
    try {
      console.log("Fetching from", url);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(QUERY),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      data = await res.json();
      if (data && Array.isArray(data.elements) && data.elements.length > 0) break;
      throw new Error("empty response");
    } catch (e) {
      console.warn("  failed:", e.message);
      lastErr = e;
    }
  }
  if (!data) throw lastErr ?? new Error("all endpoints failed");

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data));
  const rel = data.elements.filter((e) => e.type === "relation").length;
  const node = data.elements.filter((e) => e.type === "node").length;
  const way = data.elements.filter((e) => e.type === "way").length;
  console.log(`Saved ${OUT}: ${rel} relations, ${node} nodes, ${way} ways`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
