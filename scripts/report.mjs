// Reads the cached OSM data and prints, per route relation, the ordered list of
// stations (extracted from stop members) so we can verify completeness before
// generating the final dataset.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(
  readFileSync(resolve(__dirname, "../public/data/raw/osm.json"), "utf8")
);

const nodes = new Map();
for (const e of raw.elements) if (e.type === "node") nodes.set(e.id, e);

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

function orderedStations(rel) {
  const out = [];
  let last = null;
  for (const m of rel.members) {
    if (m.type !== "node") continue;
    if (!/stop|station|platform/.test(m.role || "")) continue;
    const n = nodes.get(m.ref);
    if (!isStation(n)) continue;
    const name = n.tags.name;
    if (name === last) continue; // dedupe consecutive (stop + platform pairs)
    out.push(name);
    last = name;
  }
  return out;
}

const rels = raw.elements
  .filter((e) => e.type === "relation")
  .sort((a, b) => {
    const ka = (a.tags?.network || "") + (a.tags?.ref || "");
    const kb = (b.tags?.network || "") + (b.tags?.ref || "");
    return ka.localeCompare(kb);
  });

for (const rel of rels) {
  const t = rel.tags || {};
  const st = orderedStations(rel);
  console.log(
    `\n#${rel.id} [${t.network} ref=${t.ref} colour=${t.colour}] ${t.name}`
  );
  console.log(`  stations(${st.length}): ${st.join(" | ")}`);
}
