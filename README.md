# Delhi Metro 3D

An interactive 3D digital twin of the Delhi Metro network, rendered in the browser with WebGL. Explore all 13 lines and 272 stations, watch trains move along the tracks, and plan routes across the system — set against a procedurally reconstructed model of Delhi built from real map data.

Everything is driven by real geometry from OpenStreetMap. No station orders or coordinates are invented.

## Features

- **Full network** — 13 lines, 272 stations, 25 interchanges, drawn from ordered OSM route relations with official DMRC colours.
- **Animated trains** — trains follow Catmull-Rom curves generated from each line's real geometry.
- **Route planner** — shortest-path routing over the station graph (Dijkstra), with interchange-aware connections.
- **City world** — buildings, roads, water and greenery around the network, rebuilt from OSM footprints.
- **Navigation** — station search, per-line panels, a legend, minimap, details panel and a playback bar.
- **Keyboard controls** and reduced-motion support.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19
- [Three.js](https://threejs.org/) via [@react-three/fiber](https://github.com/pmndrs/react-three-fiber), [drei](https://github.com/pmndrs/drei) and [postprocessing](https://github.com/pmndrs/react-postprocessing)
- [Zustand](https://github.com/pmndrs/zustand) for state
- [Tailwind CSS 4](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/)
- TypeScript

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

The processed dataset lives in `public/data`, so the app runs out of the box without any data steps.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run data:fetch` | Download raw metro relations from the OSM Overpass API |
| `npm run data:build` | Build the metro dataset from the raw cache |
| `npm run data:validate` | Validate the generated dataset |
| `npm run data:city:fetch` | Download raw city geometry (buildings, roads, water, greenery) |
| `npm run data:city:build` | Build the city dataset from the raw cache |

## Data pipeline

The datasets under `public/data` are generated, not hand-written:

1. `data:fetch` queries the [Overpass API](https://overpass-api.de/) for the Delhi Metro, Rapid Metro Gurgaon and Noida Metro subway relations and caches the response to `public/data/raw/osm.json`.
2. `data:build` turns that cache into the runtime files: `stations.geojson`, `metro-lines.geojson`, `routes.json`, `graph.json`, `interchanges.json`, `colors.json`, `train-paths.json` and `config.json`. Station ordering and coordinates come straight from the OSM route relations.
3. `data:city:fetch` / `data:city:build` do the same for the surrounding city model.

Raw caches (`public/data/raw`, `public/data/city/raw`) are gitignored because they are large and fully regenerable from the scripts above.

## Project structure

```
app/            Next.js App Router entry (layout, page, global styles)
components/
  scene/        R3F canvas, camera, effects, sky
  metro/        Lines, network, viaducts
  stations/     Markers, labels, indicators, structures
  trains/       Animated trains
  city/         Buildings, roads, water, greenery, traffic, landmarks
  journey/      Journey playback
  ui/           Top bar, panels, search, minimap, route planner, legend
hooks/          Keyboard controls, reduced-motion
stores/         Zustand store
utils/          Data loading, routing, geo/curve helpers
types/          Shared TypeScript types
scripts/        OSM fetch + dataset build/validate scripts
public/data/    Generated metro & city datasets
```

## Data attribution

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, licensed under the [ODbL](https://opendatacommons.org/licenses/odbl/). Line names and colours follow the Delhi Metro Rail Corporation (DMRC).
