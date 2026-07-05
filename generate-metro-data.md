# Delhi Metro Data Generation Task

## Objective

Generate a complete production-ready GIS dataset for the Delhi Metro network.

This task ONLY generates the data.

DO NOT generate React, Next.js, Three.js or UI code.

---

# Existing Data

A station dataset has already been provided.

It contains:

- Station Name
- Latitude
- Longitude
- Metro Line(s)
- Layout

Use this dataset as the primary source of truth.

---

# IMPORTANT

The uploaded dataset only contains station locations.

It does NOT contain:

- ordered routes
- line geometry
- route graph
- train paths

Your job is to complete the missing data.

---

# Internet Access

You have internet access.

Use reliable public sources when required.

Preferred sources:

- Delhi Metro Rail Corporation (DMRC)
- OpenStreetMap
- Wikidata
- Wikipedia
- GTFS (if available)
- Government GIS datasets

DO NOT hallucinate station ordering.

If route topology is missing, determine the correct order from public data.

---

# Generate the following folder

public/

    data/

        stations.geojson

        metro-lines.geojson

        routes.json

        graph.json

        interchanges.json

        colors.json

        train-paths.json

        config.json

---

# stations.geojson

Convert every station into GeoJSON.

Structure:

FeatureCollection

↓

Feature

↓

Point

Properties:

id

name

lines

layout

interchange

Geometry:

longitude

latitude

---

Example

{
"type":"Feature",
"properties":{
"id":"rajiv-chowk",
"name":"Rajiv Chowk",
"lines":[
"Blue Line",
"Yellow Line"
],
"layout":"Underground",
"interchange":true
},
"geometry":{
"type":"Point",
"coordinates":[77.21826,28.63282]
}
}

---

# metro-lines.geojson

Generate one LineString Feature per metro line.

Required Lines

Red Line

Yellow Line

Blue Line

Blue Branch

Green Line

Green Branch

Pink Line

Magenta Line

Violet Line

Grey Line

Airport Express

Rapid Metro Gurgaon

Aqua Line (optional)

Each feature must contain

id

name

official color

ordered coordinates

Geometry type:

LineString

NOT MultiPoint.

---

# routes.json

Create ordered station arrays.

Example

{
"Blue Line":[
"Dwarka Sector 21",
"Dwarka Sector 8",
"Dwarka Sector 9",
...
"Noida Electronic City"
]
}

Every station must appear in the correct travel order.

Handle branches separately.

---

# graph.json

Generate a routing graph.

Example

{
"Rajiv Chowk":[
"Patel Chowk",
"Barakhamba Road"
]
}

Every station should connect to adjacent stations.

Interchanges should connect between lines.

Graph should support Dijkstra/A*.

---

# interchanges.json

Automatically detect all stations having multiple lines.

Example

[
{
"name":"Rajiv Chowk",
"lines":[
"Blue Line",
"Yellow Line"
]
}
]

---

# colors.json

Use official DMRC colors.

Example

{
"Red Line":"#E31E24",
"Yellow Line":"#FFD200",
"Blue Line":"#0072CE",
"Green Line":"#00A651",
"Violet Line":"#8E44AD",
"Pink Line":"#FF69B4",
"Magenta Line":"#D6007F",
"Grey Line":"#808080",
"Airport Express":"#F7941D"
}

---

# train-paths.json

Generate smooth train paths.

Each metro line should contain

CatmullRomCurve control points

Example

{
"Blue Line":[
[
77.058,
28.552
],
[
77.067,
28.565
],
...
]
}

These paths will later be converted into

THREE.CatmullRomCurve3

for animated trains.

---

# config.json

Generate metadata.

Example

{

"coordinateSystem":"WGS84",

"defaultCenter":[77.2090,28.6139],

"defaultZoom":120,

"scale":15000,

"version":"1.0"

}

---

# Validation

Ensure

✓ Every station exists exactly once

✓ Every line is continuous

✓ No missing stations

✓ No duplicate coordinates

✓ Correct interchange detection

✓ Official metro colors

✓ Valid GeoJSON

✓ Correct station ordering

✓ Branches handled correctly

✓ WGS84 coordinates

✓ Ready for GIS software

---

# Output Quality

The generated data should be immediately usable in:

- React Three Fiber
- Three.js
- Cesium
- MapLibre
- deck.gl
- Mapbox GL
- QGIS

without requiring additional preprocessing.

---

# Final Output

Return every generated file.

Do NOT truncate.

Do NOT summarize.

Do NOT explain.

Generate the complete dataset inside the public/data folder.

If any dataset becomes too large, automatically create multiple files while preserving the folder structure.