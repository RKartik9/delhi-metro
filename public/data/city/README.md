# City data (central Delhi 3D world)

Generated geometry for the 3D city that the metro network sits inside. All
coordinates are baked into **scene meters** (X = east, Y = north) using the same
equirectangular projection as [`utils/geo.ts`](../../../utils/geo.ts), centered on
`[77.209, 28.6139]` (Connaught Place area). 1 scene unit = 1 meter.

## Provenance

Data (c) OpenStreetMap contributors, ODbL. Fetched from the Overpass API for a
~5 km radius around the center.

## Regenerate

```bash
npm run data:city:fetch   # downloads raw OSM into public/data/city/raw/
npm run data:city:build   # projects + tiles into the files below
```

Adjust `RADIUS_KM` in [`scripts/fetch-city-osm.mjs`](../../../scripts/fetch-city-osm.mjs)
and [`scripts/build-city.mjs`](../../../scripts/build-city.mjs) to change coverage.

## Files

- `city-config.json` - center, radius, tile size, generation metadata, counts.
- `buildings.json` - `{ tileSize, tiles: { "tx_ty": [ { r:[x0,y0,...], h } ] } }`.
  Footprints are flat meter rings (`r`) with a building `h`eight in meters,
  grouped into `tileSize` (500 m) tiles for batched rendering / culling.
- `water.json` - `[ { r:[x,y,...] } ]` water-body polygons (Yamuna, lakes).
- `greenery.json` - `[ { r:[x,y,...], k } ]` parks/forest/grass polygons; `k` is
  the kind (`park` | `forest` | `grass` | `pitch` | `cemetery`).
- `roads.json` - `[ { p:[x,y,...], w, c } ]` road polylines with `w`idth (m) and
  highway `c`lass.

Rings drop their closing duplicate vertex (consumers re-close the loop) and are
lightly decimated (tiny segments removed) to keep files compact.
