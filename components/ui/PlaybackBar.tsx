"use client";

import {
  Play,
  Pause,
  Gauge,
  Orbit,
  Video,
  Layers,
  TrainFront,
  Footprints,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useMetroStore, type CameraMode } from "@/stores/useMetroStore";

const MODES: { id: CameraMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "orbit", label: "Orbit", icon: <Orbit className="h-3.5 w-3.5" />, hint: "O" },
  { id: "top", label: "Top", icon: <Layers className="h-3.5 w-3.5" />, hint: "T" },
  { id: "fly", label: "Fly", icon: <Video className="h-3.5 w-3.5" />, hint: "C" },
  { id: "follow", label: "Follow", icon: <TrainFront className="h-3.5 w-3.5" />, hint: "V" },
  { id: "street", label: "Street", icon: <Footprints className="h-3.5 w-3.5" />, hint: "G" },
];

/** Bottom-center transport: animation play/pause, train speed, camera modes. */
export default function PlaybackBar() {
  const animationPlaying = useMetroStore((s) => s.animationPlaying);
  const toggleAnimation = useMetroStore((s) => s.toggleAnimation);
  const trainSpeed = useMetroStore((s) => s.trainSpeed);
  const setTrainSpeed = useMetroStore((s) => s.setTrainSpeed);
  const cameraMode = useMetroStore((s) => s.cameraMode);
  const setCameraMode = useMetroStore((s) => s.setCameraMode);
  const clearSelection = useMetroStore((s) => s.clearSelection);
  const enterStreetView = useMetroStore((s) => s.enterStreetView);

  const selectMode = (mode: CameraMode) => {
    if (mode === "street") {
      // Street view resolves its own spawn (map focus or Rajiv Chowk).
      if (cameraMode !== "street") enterStreetView();
      return;
    }
    // Follow keeps the current line selection (it chases a train on that line);
    // the other modes drop the selection so the framing actually changes.
    if (mode !== "follow") clearSelection();
    setCameraMode(mode);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
      <div className="glass pointer-events-auto flex items-center gap-2 rounded-2xl px-2.5 py-2">
        {/* Play / pause */}
        <button
          type="button"
          onClick={toggleAnimation}
          aria-label={animationPlaying ? "Pause trains" : "Play trains"}
          title={animationPlaying ? "Pause trains (Space)" : "Play trains (Space)"}
          className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ui-active)] text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover)]"
        >
          {animationPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>

        {/* Speed */}
        <div className="flex items-center gap-2 border-l border-[var(--ui-border)] pl-2.5">
          <Gauge className="h-4 w-4 text-[var(--ui-muted)]" />
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={trainSpeed}
            onChange={(e) => setTrainSpeed(Number(e.target.value))}
            className="ui-range w-28"
            aria-label="Train speed"
          />
          <span className="w-9 text-right text-[11px] font-medium tabular-nums text-[var(--ui-fg)]">
            {trainSpeed.toFixed(2)}x
          </span>
        </div>

        {/* Camera modes */}
        <div
          className="flex items-center gap-1 border-l border-[var(--ui-border)] pl-2.5"
          style={{ "--accent": "#5a9dff" } as CSSProperties}
        >
          {MODES.map((m) => {
            const active = cameraMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMode(m.id)}
                title={`${m.label} camera (${m.hint})`}
                className={
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
                  (active
                    ? "bg-[var(--ui-active)] text-[var(--ui-fg)]"
                    : "text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-fg)]")
                }
              >
                {m.icon}
                <span className="hidden md:inline">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
