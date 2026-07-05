// Fetches the generated dataset from /public/data and assembles a fully indexed,
// projected MetroData structure for the app.
import { project } from "@/utils/geo";
import type {
  ColorsData,
  GraphData,
  InterchangeEntry,
  LinesGeoJSON,
  MetroConfig,
  MetroData,
  MetroLine,
  RoutesData,
  Station,
  StationsGeoJSON,
  TrainPathsData,
} from "@/types/metro";

const BASE = "/data";

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}/${file}`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load ${file}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function loadMetroData(): Promise<MetroData> {
  const [
    config,
    colors,
    stationsGeo,
    linesGeo,
    routes,
    graph,
    interchanges,
  ] = await Promise.all([
    fetchJson<MetroConfig>("config.json"),
    fetchJson<ColorsData>("colors.json"),
    fetchJson<StationsGeoJSON>("stations.geojson"),
    fetchJson<LinesGeoJSON>("metro-lines.geojson"),
    fetchJson<RoutesData>("routes.json"),
    fetchJson<GraphData>("graph.json"),
    fetchJson<InterchangeEntry[]>("interchanges.json"),
  ]);
  const trainPaths = await fetchJson<TrainPathsData>("train-paths.json");

  // Stations (projected into the Z-up scene).
  const stations: Station[] = stationsGeo.features.map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    return {
      id: f.properties.id,
      name: f.properties.name,
      lines: f.properties.lines,
      layout: f.properties.layout,
      interchange: f.properties.interchange,
      lng,
      lat,
      position: project(lng, lat, 0),
    };
  });

  const stationsById: Record<string, Station> = {};
  const stationsByName: Record<string, Station> = {};
  for (const s of stations) {
    stationsById[s.id] = s;
    stationsByName[s.name] = s;
  }

  // Lines: combine geometry (metro-lines.geojson) with ordered routes and
  // train-path control points.
  const lines: MetroLine[] = linesGeo.features.map((f) => {
    const name = f.properties.name;
    const route = routes[name] ?? [];
    return {
      id: f.properties.id,
      name,
      color: f.properties.color,
      route,
      stationIds: route
        .map((n) => stationsByName[n]?.id)
        .filter((id): id is string => Boolean(id)),
      coordinates: f.geometry.coordinates,
      controlPoints: trainPaths[name] ?? f.geometry.coordinates,
    };
  });

  const linesById: Record<string, MetroLine> = {};
  for (const l of lines) linesById[l.id] = l;

  return {
    config,
    colors,
    lines,
    linesById,
    stations,
    stationsById,
    stationsByName,
    interchanges,
    routes,
    graph,
  };
}
