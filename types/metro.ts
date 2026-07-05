// Shared types for the Delhi Metro dataset (see public/data) and the app domain.

// --- Minimal GeoJSON (RFC 7946) ---------------------------------------------
export type Position = [number, number]; // [lng, lat]

export interface PointGeometry {
  type: "Point";
  coordinates: Position;
}

export interface LineStringGeometry {
  type: "LineString";
  coordinates: Position[];
}

export interface Feature<G, P> {
  type: "Feature";
  properties: P;
  geometry: G;
}

export interface FeatureCollection<G, P> {
  type: "FeatureCollection";
  features: Feature<G, P>[];
}

// --- Raw file shapes (public/data) ------------------------------------------
export type StationLayout = "Underground" | "Elevated" | "At Grade";

export interface StationProperties {
  id: string;
  name: string;
  lines: string[];
  layout: StationLayout;
  interchange: boolean;
}

export interface LineProperties {
  id: string;
  name: string;
  color: string;
}

export type StationsGeoJSON = FeatureCollection<PointGeometry, StationProperties>;
export type LinesGeoJSON = FeatureCollection<LineStringGeometry, LineProperties>;

export interface InterchangeEntry {
  name: string;
  id: string;
  lines: string[];
}

export type RoutesData = Record<string, string[]>;
export type GraphData = Record<string, string[]>;
export type ColorsData = Record<string, string>;
export type TrainPathsData = Record<string, Position[]>;

export interface MetroConfig {
  coordinateSystem: string;
  defaultCenter: Position;
  defaultZoom: number;
  scale: number;
  version: string;
  attribution: string;
  generatedAt: string;
  counts: {
    lines: number;
    stations: number;
    interchanges: number;
  };
}

// --- App domain models ------------------------------------------------------
/** A scene position in the Z-up world: [x (east), y (north), z (height)]. */
export type Vec3 = [number, number, number];

export interface Station {
  id: string;
  name: string;
  lines: string[];
  layout: StationLayout;
  interchange: boolean;
  lng: number;
  lat: number;
  /** Projected scene position (Z-up). */
  position: Vec3;
}

export interface MetroLine {
  id: string;
  name: string;
  color: string;
  /** Ordered station ids along the line. */
  stationIds: string[];
  /** Ordered station names along the line (from routes.json). */
  route: string[];
  /** Full LineString geometry in WGS84 [lng, lat]. */
  coordinates: Position[];
  /** CatmullRom control points in WGS84 [lng, lat] (train-paths.json). */
  controlPoints: Position[];
}

export type TrainDirection = 1 | -1;

export interface Train {
  id: string;
  lineId: string;
  /** Normalised progress along the curve in [0, 1]. */
  progress: number;
  direction: TrainDirection;
  /** Progress per second. */
  speed: number;
}

/** A run of consecutive stations travelled on a single line. */
export interface RouteSegment {
  lineId: string;
  /** Ordered station ids for this segment (shares boundary stations with neighbours). */
  stationIds: string[];
}

/** A computed journey from one station to another. */
export interface RoutePlan {
  fromId: string;
  toId: string;
  /** Full ordered path of station ids. */
  stationIds: string[];
  /** Path grouped into single-line segments. */
  segments: RouteSegment[];
  /** Station ids where the rider changes lines. */
  interchangeIds: string[];
  /** Number of line changes. */
  transfers: number;
  /** Number of hops between stations. */
  numStops: number;
  /** Approximate travelled distance in km. */
  distanceKm: number;
}

/** Fully loaded, indexed dataset used across the app. */
export interface MetroData {
  config: MetroConfig;
  colors: ColorsData;
  lines: MetroLine[];
  linesById: Record<string, MetroLine>;
  stations: Station[];
  stationsById: Record<string, Station>;
  stationsByName: Record<string, Station>;
  interchanges: InterchangeEntry[];
  routes: RoutesData;
  graph: GraphData;
}
