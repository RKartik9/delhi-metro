"use client";

import { useMetroStore } from "@/stores/useMetroStore";
import StationStructures from "./StationStructures";
import StationMarkers from "./StationMarkers";
import StationLabels from "./StationLabels";
import StationIndicators from "./StationIndicators";

/** All station visuals: 3D platform structures, markers, labels, indicators. */
export default function Stations() {
  const metroVisible = useMetroStore((s) => s.layers.metro);
  if (!metroVisible) return null;

  return (
    <group name="stations">
      <StationStructures />
      <StationMarkers />
      <StationIndicators />
      <StationLabels />
    </group>
  );
}
