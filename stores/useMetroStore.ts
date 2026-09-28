import { create } from "zustand";
import { loadMetroData } from "@/utils/loadData";
import { loadCityData } from "@/utils/loadCity";
import { findRoute } from "@/utils/router";
import type { MetroData, RoutePlan } from "@/types/metro";
import type { CityData, CityLayers } from "@/types/city";
import {
  defaultStreetSpawn,
  resolveStreetSpawn,
  type StreetSpawn,
} from "@/utils/streetSpawn";
import { streetRig, MAP_FOCUS_MAX_DIST } from "@/utils/streetRig";

export type LoadStatus = "idle" | "loading" | "ready" | "error";
export type Theme = "day" | "night";
export type CameraMode = "orbit" | "top" | "follow" | "fly" | "free" | "street";

/** Where to drop into street view. */
export interface StreetEntry {
  x: number;
  y: number;
  /** Optional explicit heading (radians, 0 = east). */
  yaw?: number;
  /** Optional point to face after landing (scene meters). */
  lookAt?: [number, number];
}

interface MetroState {
  // Data
  status: LoadStatus;
  error: string | null;
  data: MetroData | null;

  // City (3D world)
  cityStatus: LoadStatus;
  city: CityData | null;
  layers: CityLayers;

  // Environment: normalized time of day (0 = midnight, 0.5 = noon).
  timeOfDay: number;

  // Selection & hover
  selectedLineId: string | null;
  selectedStationId: string | null;
  hoveredLineId: string | null;
  hoveredStationId: string | null;

  // Filters (lines toggled off)
  hiddenLineIds: Set<string>;

  // Journey planner
  fromStationId: string | null;
  toStationId: string | null;
  route: RoutePlan | null;
  routeError: string | null;
  journeyPlaying: boolean;

  // Environment & view
  theme: Theme;
  cameraMode: CameraMode;
  /** Resolved spawn for the street-level camera (set by enterStreetView). */
  streetSpawn: StreetSpawn | null;

  // Animation
  animationPlaying: boolean;
  trainSpeed: number;

  // Actions
  load: () => Promise<void>;
  loadCity: () => Promise<void>;
  toggleLayer: (layer: keyof CityLayers) => void;
  setTimeOfDay: (t: number) => void;
  selectLine: (id: string | null) => void;
  selectStation: (id: string | null) => void;
  hoverLine: (id: string | null) => void;
  hoverStation: (id: string | null) => void;
  clearSelection: () => void;
  resetView: () => void;
  toggleLineVisibility: (id: string) => void;
  setLineVisibility: (id: string, visible: boolean) => void;
  showAllLines: () => void;
  isLineVisible: (id: string) => boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setCameraMode: (mode: CameraMode) => void;
  /**
   * Drop into street view. With no argument, lands where the aerial camera
   * was looking (if inside the detailed core) or at Rajiv Chowk.
   */
  enterStreetView: (at?: StreetEntry) => void;
  /** Leave street view; the camera lifts back to a bird's-eye. */
  exitStreetView: () => void;
  setAnimationPlaying: (playing: boolean) => void;
  toggleAnimation: () => void;
  setTrainSpeed: (speed: number) => void;

  setFromStation: (id: string | null) => void;
  setToStation: (id: string | null) => void;
  swapStations: () => void;
  clearRoute: () => void;
  toggleJourney: () => void;
  setJourneyPlaying: (playing: boolean) => void;
}

export const useMetroStore = create<MetroState>((set, get) => ({
  status: "idle",
  error: null,
  data: null,

  cityStatus: "idle",
  city: null,
  layers: {
    buildings: true,
    roads: true,
    water: true,
    greenery: true,
    metro: true,
  },
  timeOfDay: 0.5,

  selectedLineId: null,
  selectedStationId: null,
  hoveredLineId: null,
  hoveredStationId: null,

  hiddenLineIds: new Set<string>(),

  fromStationId: null,
  toStationId: null,
  route: null,
  routeError: null,
  journeyPlaying: false,

  theme: "night",
  cameraMode: "orbit",
  streetSpawn: null,

  animationPlaying: true,
  trainSpeed: 1,

  load: async () => {
    const { status } = get();
    if (status === "loading" || status === "ready") return;
    set({ status: "loading", error: null });
    try {
      const data = await loadMetroData();
      set({ data, status: "ready" });
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  },

  loadCity: async () => {
    const { cityStatus } = get();
    if (cityStatus === "loading" || cityStatus === "ready") return;
    set({ cityStatus: "loading" });
    try {
      const city = await loadCityData();
      set({ city, cityStatus: "ready" });
    } catch (e) {
      set({ cityStatus: "error" });
      console.error("Failed to load city data:", e);
    }
  },
  toggleLayer: (layer) =>
    set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  setTimeOfDay: (t) => {
    const timeOfDay = Math.max(0, Math.min(1, t));
    // Derive the UI theme so panels read correctly against the sky.
    const theme = timeOfDay > 0.24 && timeOfDay < 0.76 ? "day" : "night";
    set({ timeOfDay, theme });
  },

  // Selecting a line or station is mutually exclusive.
  selectLine: (id) => set({ selectedLineId: id, selectedStationId: null }),
  selectStation: (id) => set({ selectedStationId: id, selectedLineId: null }),
  hoverLine: (id) => set({ hoveredLineId: id }),
  hoverStation: (id) => set({ hoveredStationId: id }),
  clearSelection: () => set({ selectedLineId: null, selectedStationId: null }),
  resetView: () =>
    set({
      cameraMode: "orbit",
      selectedLineId: null,
      selectedStationId: null,
    }),

  toggleLineVisibility: (id) =>
    set((s) => {
      const next = new Set(s.hiddenLineIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { hiddenLineIds: next };
    }),
  setLineVisibility: (id, visible) =>
    set((s) => {
      const next = new Set(s.hiddenLineIds);
      if (visible) next.delete(id);
      else next.add(id);
      return { hiddenLineIds: next };
    }),
  showAllLines: () => set({ hiddenLineIds: new Set<string>() }),
  isLineVisible: (id) => !get().hiddenLineIds.has(id),

  setTheme: (theme) =>
    set({ theme, timeOfDay: theme === "day" ? 0.5 : 0.0 }),
  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === "day" ? "night" : "day";
      return { theme, timeOfDay: theme === "day" ? 0.5 : 0.0 };
    }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  enterStreetView: (at) => {
    const { city, data } = get();
    // Drop in where the aerial camera was looking only when it was zoomed in
    // close; from the overview, Rajiv Chowk is the default entry point.
    const focus =
      streetRig.mapFocusDist < MAP_FOCUS_MAX_DIST
        ? ([streetRig.mapFocus.x, streetRig.mapFocus.y] as [number, number])
        : null;
    const spawn = at
      ? resolveStreetSpawn(city, at.x, at.y, at.lookAt, at.yaw)
      : defaultStreetSpawn(city, data, focus);
    set({
      cameraMode: "street",
      streetSpawn: spawn,
      selectedLineId: null,
      selectedStationId: null,
    });
  },
  exitStreetView: () => {
    if (get().cameraMode !== "street") return;
    set({ cameraMode: "orbit" });
  },

  setAnimationPlaying: (playing) => set({ animationPlaying: playing }),
  toggleAnimation: () => set((s) => ({ animationPlaying: !s.animationPlaying })),
  setTrainSpeed: (speed) => set({ trainSpeed: speed }),

  setFromStation: (id) => {
    set({ fromStationId: id });
    recomputeRoute(get, set);
  },
  setToStation: (id) => {
    set({ toStationId: id });
    recomputeRoute(get, set);
  },
  swapStations: () => {
    set((s) => ({ fromStationId: s.toStationId, toStationId: s.fromStationId }));
    recomputeRoute(get, set);
  },
  clearRoute: () =>
    set({
      fromStationId: null,
      toStationId: null,
      route: null,
      routeError: null,
      journeyPlaying: false,
    }),
  toggleJourney: () => set((s) => ({ journeyPlaying: !s.journeyPlaying })),
  setJourneyPlaying: (playing) => set({ journeyPlaying: playing }),
}));

/** Recomputes the route when both endpoints are set; clears it otherwise. */
function recomputeRoute(
  get: () => MetroState,
  set: (partial: Partial<MetroState>) => void
): void {
  const { fromStationId, toStationId, data } = get();
  if (!fromStationId || !toStationId || !data) {
    set({ route: null, routeError: null, journeyPlaying: false });
    return;
  }
  if (fromStationId === toStationId) {
    set({ route: null, routeError: "Choose two different stations" });
    return;
  }
  const route = findRoute(fromStationId, toStationId, data);
  if (route) {
    set({
      route,
      routeError: null,
      journeyPlaying: true,
      selectedLineId: null,
      selectedStationId: null,
    });
  } else {
    set({ route: null, routeError: "No route found between these stations" });
  }
}
