"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TrainFront } from "lucide-react";
import { useMetroStore } from "@/stores/useMetroStore";
import TopBar from "./TopBar";
import LinesPanel from "./LinesPanel";
import DetailsPanel from "./DetailsPanel";
import PlaybackBar from "./PlaybackBar";
import Minimap from "./Minimap";
import RoutePlanner from "./RoutePlanner";
import WorldControls from "./WorldControls";
import StreetHUD from "./StreetHUD";

/**
 * The full HUD overlay: composes every glassmorphism panel over the 3D canvas
 * and gates them behind the dataset load status. `pointer-events-none` on the
 * root lets clicks fall through to the canvas except where a panel opts in.
 */
export default function UIShell() {
  const status = useMetroStore((s) => s.status);
  const error = useMetroStore((s) => s.error);
  const theme = useMetroStore((s) => s.theme);
  // Street view keeps the HUD minimal (Earth-style): only the transport bar,
  // minimap and the street readout stay on screen.
  const street = useMetroStore((s) => s.cameraMode === "street");

  return (
    <div
      className="ui-root pointer-events-none absolute inset-0 select-none"
      data-theme={theme}
    >
      <TopBar />

      <AnimatePresence>
        {status === "ready" && (
          <motion.div
            key="hud"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {!street && (
              <>
                <div className="absolute left-1/2 top-20 -translate-x-1/2 lg:top-4">
                  <RoutePlanner />
                </div>
                <div className="absolute left-4 top-20 hidden md:block">
                  <LinesPanel />
                </div>
                <div className="hidden md:contents">
                  <DetailsPanel />
                </div>
                <WorldControls />
              </>
            )}
            <AnimatePresence>{street && <StreetHUD key="street-hud" />}</AnimatePresence>
            <PlaybackBar />
            <div className="hidden sm:block">
              <Minimap />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {status !== "ready" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="glass flex flex-col items-center gap-3 rounded-2xl px-8 py-6">
            {status === "error" ? (
              <>
                <span className="text-sm font-semibold text-red-300">
                  Failed to load network data
                </span>
                <span className="max-w-xs text-center text-xs text-[var(--ui-muted)]">
                  {error}
                </span>
              </>
            ) : (
              <>
                <TrainFront className="h-6 w-6 animate-pulse text-[var(--ui-muted)]" />
                <span className="text-xs uppercase tracking-[0.3em] text-[var(--ui-muted)]">
                  Loading Delhi Metro
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
