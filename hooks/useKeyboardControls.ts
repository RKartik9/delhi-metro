"use client";

import { useEffect } from "react";
import { useMetroStore } from "@/stores/useMetroStore";

/**
 * Global keyboard shortcuts for camera/view control:
 *   R / Home  reset view      T top view       O orbit
 *   F free camera   C cinematic fly   V follow train   Esc clear selection
 *   Space toggle train animation
 */
export function useKeyboardControls() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const store = useMetroStore.getState();
      switch (e.key) {
        case "r":
        case "R":
        case "Home":
          store.resetView();
          break;
        case "t":
        case "T":
          store.clearSelection();
          store.setCameraMode("top");
          break;
        case "o":
        case "O":
          store.clearSelection();
          store.setCameraMode("orbit");
          break;
        case "f":
        case "F":
          store.clearSelection();
          store.setCameraMode("free");
          break;
        case "c":
        case "C":
          store.clearSelection();
          store.setCameraMode(store.cameraMode === "fly" ? "orbit" : "fly");
          break;
        case "v":
        case "V":
          // Follow a train. Keeps any current line selection so the camera
          // chases a train on that line; otherwise it follows the first line.
          store.setCameraMode(store.cameraMode === "follow" ? "orbit" : "follow");
          break;
        case "Escape":
          store.clearSelection();
          break;
        case " ":
          e.preventDefault();
          store.toggleAnimation();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
