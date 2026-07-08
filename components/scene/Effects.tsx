"use client";

import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Screen-space post-processing for the city: mild bloom lifts lights and neon,
 * SMAA cleans edges, and a soft vignette focuses the frame. Renderer-side ACES
 * tone mapping (set on the Canvas) is preserved, so no ToneMapping effect here.
 *
 * Note: no SSAO. At this scene scale (tens of kilometres) SSAO reads a very
 * low-precision depth buffer and its per-frame noise pattern makes the whole
 * frame shimmer during camera motion.
 */
export default function Effects() {
  const reduced = usePrefersReducedMotion();
  return (
    <EffectComposer multisampling={0}>
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
