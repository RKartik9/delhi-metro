"use client";

import { EffectComposer, Bloom, Vignette, SMAA, SSAO } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Screen-space post-processing for the city: SSAO adds contact shadow / depth
 * between buildings, mild bloom lifts lights and neon, SMAA cleans edges, and a
 * soft vignette focuses the frame. Renderer-side ACES tone mapping (set on the
 * Canvas) is preserved, so no ToneMapping effect here.
 */
export default function Effects() {
  const reduced = usePrefersReducedMotion();
  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={16}
        rings={4}
        radius={6}
        intensity={22}
        luminanceInfluence={0.6}
        bias={0.03}
        color={undefined}
        worldDistanceThreshold={15_000}
        worldDistanceFalloff={3_000}
        worldProximityThreshold={60}
        worldProximityFalloff={30}
      />
      <Bloom
        intensity={reduced ? 0.35 : 0.6}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.25}
        mipmapBlur
        radius={0.65}
      />
      <Vignette eskil={false} offset={0.2} darkness={0.8} />
      <SMAA />
    </EffectComposer>
  );
}
