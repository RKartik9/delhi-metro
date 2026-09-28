"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Footprints, Compass, X, MousePointer2, Keyboard } from "lucide-react";
import { useMetroStore } from "@/stores/useMetroStore";
import { streetRig, yawToBearing, bearingToCardinal } from "@/utils/streetRig";

const POLL_MS = 100;
const HINT_MS = 7_000;

interface Readout {
  stationName: string | null;
  stationDist: number;
  bearing: number;
}

function formatDistance(m: number): string {
  return m < 950 ? `${Math.round(m / 5) * 5} m` : `${(m / 1000).toFixed(1)} km`;
}

/**
 * Minimal overlay for street view: where you are (nearest station), which way
 * you face, an exit button, and a controls hint that fades after a few seconds.
 */
export default function StreetHUD() {
  const data = useMetroStore((s) => s.data);
  const exitStreetView = useMetroStore((s) => s.exitStreetView);
  const [readout, setReadout] = useState<Readout>({
    stationName: null,
    stationDist: 0,
    bearing: 0,
  });
  const [showHint, setShowHint] = useState(true);

  // Poll the rig singleton at ~10 Hz (it is written every frame outside React).
  useEffect(() => {
    const tick = () => {
      const p = streetRig.position;
      let best: { name: string; d: number } | null = null;
      if (data) {
        for (const s of data.stations) {
          const d = Math.hypot(s.position[0] - p.x, s.position[1] - p.y);
          if (!best || d < best.d) best = { name: s.name, d };
        }
      }
      setReadout({
        stationName: best?.name ?? null,
        stationDist: best?.d ?? 0,
        bearing: yawToBearing(streetRig.yaw),
      });
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [data]);

  useEffect(() => {
    const id = window.setTimeout(() => setShowHint(false), HINT_MS);
    return () => window.clearTimeout(id);
  }, []);

  const cardinal = bearingToCardinal(readout.bearing);

  return (
    <>
      {/* Location / heading pill */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3 }}
        className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 lg:top-4"
      >
        <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl py-2 pl-3.5 pr-2">
          <Footprints className="h-4 w-4 text-[var(--ui-muted)]" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ui-faint)]">
              Street view
            </span>
            <span className="truncate text-[12.5px] font-medium text-[var(--ui-fg)]">
              {readout.stationName ? (
                <>
                  {readout.stationName}
                  <span className="text-[var(--ui-muted)]">
                    {" "}
                    · {formatDistance(readout.stationDist)}
                  </span>
                </>
              ) : (
                "Connaught Place"
              )}
            </span>
          </div>

          <div
            className="flex items-center gap-1.5 border-l border-[var(--ui-border)] pl-3 text-[11px] tabular-nums text-[var(--ui-muted)]"
            title="Heading"
          >
            <Compass
              className="h-3.5 w-3.5 transition-transform"
              style={{ transform: `rotate(${-readout.bearing}deg)` }}
            />
            <span className="w-14">
              {Math.round(readout.bearing).toString().padStart(3, "0")}° {cardinal}
            </span>
          </div>

          <button
            type="button"
            onClick={exitStreetView}
            title="Exit street view (Esc)"
            className="flex items-center gap-1.5 rounded-xl bg-[var(--ui-active)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover)]"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </motion.div>

      {/* Controls hint */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            key="street-hint"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center"
          >
            <div className="glass flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-2xl px-4 py-2 text-[11px] text-[var(--ui-muted)]">
              <span className="flex items-center gap-1.5">
                <MousePointer2 className="h-3.5 w-3.5" /> Drag to look
              </span>
              <span className="flex items-center gap-1.5">
                <Keyboard className="h-3.5 w-3.5" />
                <Key>W</Key>
                <Key>A</Key>
                <Key>S</Key>
                <Key>D</Key> walk
                <span className="text-[var(--ui-faint)]">·</span>
                <Key>Shift</Key> run
              </span>
              <span>Scroll to move</span>
              <span>Click to go there</span>
              <span className="flex items-center gap-1.5">
                <Key>Esc</Key> exit
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-active)] px-1.5 py-0.5 font-sans text-[10px] font-medium text-[var(--ui-fg)]">
      {children}
    </kbd>
  );
}
