"use client";

import { useMetroStore } from "@/stores/useMetroStore";
import MetroLine from "./MetroLine";
import Viaducts from "./Viaducts";

/** Renders every metro line in the loaded dataset plus its viaduct pillars. */
export default function MetroNetwork() {
  const lines = useMetroStore((s) => s.data?.lines);
  const metroVisible = useMetroStore((s) => s.layers.metro);

  if (!lines || !metroVisible) return null;

  return (
    <group name="metro-network">
      {lines.map((line, i) => (
        <MetroLine key={line.id} line={line} index={i} />
      ))}
      <Viaducts />
    </group>
  );
}
