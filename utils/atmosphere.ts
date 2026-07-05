// Maps a normalized time-of-day (0 = midnight, 0.25 = sunrise, 0.5 = noon,
// 0.75 = sunset) to a coherent set of sky / sun / lighting parameters shared by
// the sky dome, scene lighting, fog, and water. World is Z-up (Z = zenith).
import * as THREE from "three";

export interface Atmosphere {
  /** Direction from the scene toward the sun (normalized, Z-up). */
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  skyHorizon: THREE.Color;
  skyZenith: THREE.Color;
  fogColor: THREE.Color;
  groundColor: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  ambient: number;
  hemiIntensity: number;
  sunIntensity: number;
  /** Star opacity, 1 at night -> 0 in daylight. */
  stars: number;
  /** Daylight factor 0..1 (0 night, 1 day). */
  day: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Reusable temp colors to avoid per-call allocation churn.
const cZenithNight = new THREE.Color("#05070f");
const cZenithDay = new THREE.Color("#3f79c0");
const cHorizonNight = new THREE.Color("#0b1326");
const cHorizonDay = new THREE.Color("#aecbe8");
const cGold = new THREE.Color("#f4a860");
const cSunDay = new THREE.Color("#fff2d0");
const cSunMoon = new THREE.Color("#9fb0d6");
const cGroundNight = new THREE.Color("#0b1120");
const cGroundDay = new THREE.Color("#c9d4e2");

export function computeAtmosphere(timeOfDay: number): Atmosphere {
  const angle = (timeOfDay - 0.25) * Math.PI * 2;
  const e = Math.sin(angle); // sun elevation, -1..1
  const hx = Math.cos(angle); // +1 at sunrise (east) -> -1 at sunset (west)

  const sunDir = new THREE.Vector3(hx, -0.32, Math.max(e, -0.4)).normalize();

  const day = smoothstep(-0.08, 0.22, e);
  const gold = e > -0.12 ? THREE.MathUtils.clamp(1 - Math.abs(e) / 0.22, 0, 1) : 0;

  const skyZenith = cZenithNight.clone().lerp(cZenithDay, day);
  const skyHorizon = cHorizonNight.clone().lerp(cHorizonDay, day).lerp(cGold, gold * 0.75);
  const sunColor = cSunMoon.clone().lerp(cSunDay, day).lerp(cGold, gold * 0.85);
  const groundColor = cGroundNight.clone().lerp(cGroundDay, day);
  const fogColor = skyHorizon.clone();

  return {
    sunDir,
    sunColor,
    skyHorizon,
    skyZenith,
    fogColor,
    groundColor,
    hemiSky: skyZenith.clone().lerp(new THREE.Color("#dfe8ff"), day * 0.4),
    hemiGround: groundColor.clone(),
    ambient: 0.22 + 0.34 * day,
    hemiIntensity: 0.32 + 0.62 * day,
    sunIntensity: 0.25 + 2.0 * day + gold * 0.4,
    stars: 1 - day,
    day,
  };
}
