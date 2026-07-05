"use client";

import Buildings from "./Buildings";
import Water from "./Water";
import Greenery from "./Greenery";
import Roads from "./Roads";
import Landmarks from "./Landmarks";
import Traffic from "./Traffic";
import Streetlights from "./Streetlights";

/**
 * The 3D OpenStreetMap city that the metro network runs through: ground layers
 * (greenery, water, roads), extruded buildings, landmarks, and city life
 * (moving traffic + streetlights).
 */
export default function CityWorld() {
  return (
    <group name="city">
      <Greenery />
      <Water />
      <Roads />
      <Buildings />
      <Landmarks />
      <Streetlights />
      <Traffic />
    </group>
  );
}
