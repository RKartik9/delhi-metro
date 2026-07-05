// Fetches the generated 3D city dataset from /public/data/city.
import type {
  BuildingsData,
  CityConfig,
  CityData,
  PolyItem,
  RoadItem,
} from "@/types/city";

const BASE = "/data/city";

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}/${file}`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load ${file}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function loadCityData(): Promise<CityData> {
  const [config, buildings, water, greenery, roads] = await Promise.all([
    fetchJson<CityConfig>("city-config.json"),
    fetchJson<BuildingsData>("buildings.json"),
    fetchJson<PolyItem[]>("water.json"),
    fetchJson<PolyItem[]>("greenery.json"),
    fetchJson<RoadItem[]>("roads.json"),
  ]);
  return { config, buildings, water, greenery, roads };
}
