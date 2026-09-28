import * as THREE from "three";

/**
 * Procedural facades for the extruded OSM buildings, injected into a stock
 * MeshStandardMaterial so lighting, shadows and fog keep working.
 *
 * Per-vertex `aBuilding` = (seed 0..1, height m). The flat per-face normal
 * gives each wall a tangent in the vertex shader; walls get a window grid in
 * wall-local (along, height) space with a shopfront ground floor,
 * floor bands, contact shading near the ground and warm lit windows at night.
 * Everything is fwidth-anti-aliased and fades out with view distance so the
 * aerial view stays clean and the 158k-building city does not shimmer.
 */

export interface FacadeUniforms {
  /** 0 = full daylight, 1 = deep night (drives lit windows). */
  uNight: { value: number };
}

export function createFacadeUniforms(): FacadeUniforms {
  return { uNight: { value: 0 } };
}

const VERT_DECL = /* glsl */ `
attribute vec2 aBuilding;
varying vec3 vFacadeWorldPos;
varying vec2 vBuilding;
/** (along-facade metres, wall flag): computed per vertex from the flat face
 * normal so it interpolates exactly across each wall. */
varying vec2 vFacadeUW;
`;

const VERT_BODY = /* glsl */ `
{
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vec3 wn = normalize(mat3(modelMatrix) * normal);
  vec2 tangent = normalize(vec2(-wn.y, wn.x) + 1e-5);
  vFacadeWorldPos = wp;
  vFacadeUW = vec2(dot(wp.xy, tangent), 1.0 - step(0.5, abs(wn.z)));
  vBuilding = aBuilding;
}
`;

const FRAG_DECL = /* glsl */ `
varying vec3 vFacadeWorldPos;
varying vec2 vBuilding;
varying vec2 vFacadeUW;
uniform float uNight;

float facadeHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
`;

const FRAG_BODY = /* glsl */ `
vec3 facadeEmissive = vec3(0.0);
{
  float viewDist = length(vViewPosition);
  float detail = 1.0 - smoothstep(700.0, 2000.0, viewDist);
  float glow = 1.0 - smoothstep(1500.0, 4500.0, viewDist);

  if (glow > 0.001) {
    float wall = step(0.5, vFacadeUW.y);
    float h = vFacadeWorldPos.z;
    float seed = vBuilding.x;
    float bh = vBuilding.y;

    // Per-building parameters.
    float s1 = fract(seed * 7.31 + 0.17);
    float s2 = fract(seed * 13.7 + 0.53);
    float s3 = fract(seed * 3.19 + 0.91);
    float tall = smoothstep(28.0, 60.0, bh);
    float floorH = 3.2;
    float winW = mix(2.4, 4.0, s1);

    // Wall-local coordinates: along the facade, and height.
    float u = vFacadeUW.x;
    vec2 cell = vec2(u / winW, h / floorH);
    vec2 id = floor(cell);
    vec2 f = fract(cell);
    vec2 aa = fwidth(cell) * 1.25 + 1e-4;

    // Window rectangle within the cell (ribbon glass on tall towers).
    vec2 wsize = mix(vec2(0.42, 0.48), vec2(0.62, 0.58), s2);
    wsize = mix(wsize, vec2(0.96, 0.7), tall);
    float ground = 1.0 - step(3.6, h);
    wsize = mix(wsize, vec2(0.84, 0.78), ground);

    vec2 lo = 0.5 - wsize * 0.5;
    vec2 hi = 0.5 + wsize * 0.5;
    vec2 m = smoothstep(lo - aa, lo + aa, f) * (1.0 - smoothstep(hi - aa, hi + aa, f));
    float win = m.x * m.y;
    // Once cells shrink toward a pixel (distance or grazing angles) the mask
    // blurs into a uniform tint; fade the pattern out instead of glowing walls.
    win *= 1.0 - smoothstep(0.12, 0.45, max(aa.x, aa.y));

    // No windows in the partial top floor or above the roof line.
    float topOk = step((id.y + 1.0) * floorH, bh - 0.4);
    win *= topOk * wall;

    // Facade shading: darker base, thin floor bands, roof slightly darker.
    float shade = mix(0.72, 1.0, smoothstep(0.0, 2.6, h));
    float band = 1.0 - smoothstep(0.0, aa.y * 2.0, f.y);
    shade *= mix(1.0, 0.88, band * wall * (1.0 - ground));
    shade = mix(shade, 0.84 + 0.08 * facadeHash(floor(vFacadeWorldPos.xy * 0.25)), 1.0 - wall);

    // Lit windows: per-window hash vs. a per-building occupancy.
    float lit = step(facadeHash(id + seed * 41.0), 0.28 + 0.34 * s3);
    // Shopfronts: most, not all, stay lit after dark.
    lit = max(lit, ground * step(0.3, facadeHash(id * 1.7 + seed * 9.0)) * 0.8);

    vec3 wallCol = diffuseColor.rgb * mix(1.0, shade, glow);
    vec3 glass = mix(vec3(0.20, 0.25, 0.32), vec3(0.34, 0.42, 0.52), s3);
    glass = mix(glass, vec3(0.16, 0.17, 0.19), ground * 0.6);
    vec3 glassCol = mix(wallCol, glass, 0.9);

    float winMix = win * detail;
    diffuseColor.rgb = mix(wallCol, glassCol, winMix);

    vec3 warm = mix(vec3(1.0, 0.78, 0.50), vec3(0.80, 0.88, 1.0), step(0.8, s2));
    facadeEmissive = warm * (lit * win * glow) * uNight * 0.5;
  }
}
`;

const FRAG_EMISSIVE = /* glsl */ `
totalEmissiveRadiance += facadeEmissive;
`;

export function applyFacadeShader(
  material: THREE.MeshStandardMaterial,
  uniforms: FacadeUniforms
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_DECL}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_BODY}`);

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_DECL}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAG_BODY}`)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`
      );
  };
  material.customProgramCacheKey = () => "facade-v3";
}
