# Delhi Metro dataset

Generated GIS dataset for the Delhi Metro network (Phase 1).

## Provenance

- Source: OpenStreetMap route relations (`route=subway`) for networks
  `Delhi Metro`, `Rapid Metro Gurgaon`, and `Noida Metro`, fetched via the
  Overpass API.
- Station ordering and line geometry come directly from OSM relation member
  order and way geometry. No station order or coordinates are invented
  (see `../../cursor-rules.md`).
- Layout (Underground / Elevated / At Grade) is inferred per station from the
  `tunnel` / `bridge` / `layer` tags of the nearest track segment.
- Line colours are the official DMRC line colours.
- Data (c) OpenStreetMap contributors, licensed under the ODbL.

## Files

| File | Contents |
| --- | --- |
| `stations.geojson` | Point features: `id`, `name`, `lines`, `layout`, `interchange` |
| `metro-lines.geojson` | One LineString per line: `id`, `name`, `color` |
| `routes.json` | Ordered station arrays per line (branches separate) |
| `graph.json` | Adjacency list for routing (Dijkstra/A*), interchanges linked |
| `interchanges.json` | Stations serving multiple lines |
| `colors.json` | Official line colours |
| `train-paths.json` | CatmullRom control points per line (downsampled geometry) |
| `config.json` | Coordinate system, default center/zoom, scale, counts |
| `raw/osm.json` | Cached Overpass response (input for regeneration) |

## Regenerate

```bash
node scripts/fetch-osm.mjs    # download raw OSM data (needs network)
node scripts/build-data.mjs   # build the dataset files
node scripts/validate.mjs     # validate output
```

## Current coverage

13 lines (incl. Blue/Green branches), 272 stations, 25 interchanges.
Notes: the Noida Aqua Line is a separate physical network (not graph-connected
to Delhi Metro, as in reality). Under-construction Phase-4 corridors are
excluded until operational.
