"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useMetroStore } from "@/stores/useMetroStore";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";
import UIShell from "@/components/ui/UIShell";

// The 3D canvas is client-only (WebGL / window access), so load it without SSR.
const SceneCanvas = dynamic(() => import("@/components/scene/SceneCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="animate-pulse text-sm tracking-widest text-white/60">
        LOADING DELHI METRO
      </div>
    </div>
  ),
});

export default function MetroApp() {
  const load = useMetroStore((s) => s.load);
  const loadCity = useMetroStore((s) => s.loadCity);
  useKeyboardControls();

  useEffect(() => {
    load();
    loadCity();
  }, [load, loadCity]);

  return (
    <div className="relative h-full w-full">
      <SceneCanvas />
      <UIShell />
    </div>
  );
}
