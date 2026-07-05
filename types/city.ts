// Types for the generated 3D city dataset (public/data/city). All coordinates
// are baked scene meters [x, y] (see scripts/build-city.mjs).

export interface CityConfig {
  center: [number, number];
  radiusKm: number;
  tileSize: number;
  generatedAt: string;
  attribution: string;
  counts: {
    buildings: number;
    buildingTiles: number;
    water: number;
    greenery: number;
    roads: number;
  };
}

/** A building footprint: flat meter ring `r` = [x0,y0,x1,y1,...] and height `h`. */
export interface BuildingItem {
  r: number[];
  h: number;
}

export interface BuildingsData {
  tileSize: number;
  tiles: Record<string, BuildingItem[]>;
}

/** A polygon layer item (water / greenery). `k` = kind for greenery. */
export interface PolyItem {
  r: number[];
  k?: string;
}

/** A road polyline: flat points `p`, width `w` (m), highway class `c`. */
export interface RoadItem {
  p: number[];
  w: number;
  c: string;
}

export interface CityData {
  config: CityConfig;
  buildings: BuildingsData;
  water: PolyItem[];
  greenery: PolyItem[];
  roads: RoadItem[];
}

/** Toggleable world layers. */
export interface CityLayers {
  buildings: boolean;
  roads: boolean;
  water: boolean;
  greenery: boolean;
  metro: boolean;
}
