// WGS84 -> scene projection for the Z-up world.
//
// The dataset stores real geographic coordinates ([lng, lat], WGS84). For the
// 3D scene we project them onto the X/Y ground plane with an equirectangular
// projection centered on Delhi, and reserve Z for height. X = east, Y = north.
//
// World scale is METRIC: 1 scene unit = 1 meter. This keeps buildings, roads,
// trains and metro viaducts at realistic proportions in the same coordinate
// space (a 30 m building is 30 units tall). `config.defaultCenter` is the
// projection origin.
import * as THREE from "three";
import config from "@/public/data/config.json";
import type { Position, Vec3 } from "@/types/metro";

const [LNG0, LAT0] = config.defaultCenter as Position;

const DEG_TO_RAD = Math.PI / 180;
const COS_LAT0 = Math.cos(LAT0 * DEG_TO_RAD);

/** Meters per degree of latitude (mean value; good enough for a city). */
export const METERS_PER_DEG_LAT = 111_320;

/**
 * Scene units per degree of latitude. With a metric world this equals
 * METERS_PER_DEG_LAT (1 unit = 1 meter). Kept as a named export for any code
 * that reasons about the world size.
 */
export const SCENE_SCALE = METERS_PER_DEG_LAT;

/** Project a WGS84 coordinate to a Z-up scene position (meters). */
export function project(lng: number, lat: number, height = 0): Vec3 {
  const x = (lng - LNG0) * COS_LAT0 * SCENE_SCALE;
  const y = (lat - LAT0) * SCENE_SCALE;
  return [x, y, height];
}

/** Project a [lng, lat] pair. */
export function projectPosition(pos: Position, height = 0): Vec3 {
  return project(pos[0], pos[1], height);
}

/** Project a THREE.Vector3 (useful for curves/geometry). */
export function projectToVector3(pos: Position, height = 0): THREE.Vector3 {
  const [x, y, z] = projectPosition(pos, height);
  return new THREE.Vector3(x, y, z);
}

/** Project a full path of [lng, lat] pairs into scene Vector3s. */
export function projectPath(coords: Position[], height = 0): THREE.Vector3[] {
  return coords.map((c) => projectToVector3(c, height));
}

/** Approximate great-circle distance between two WGS84 points, in km. */
export function haversineKm(a: Position, b: Position): number {
  const R = 6371;
  const dLat = (b[1] - a[1]) * DEG_TO_RAD;
  const dLng = (b[0] - a[0]) * DEG_TO_RAD;
  const lat1 = a[1] * DEG_TO_RAD;
  const lat2 = b[1] * DEG_TO_RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
