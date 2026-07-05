"use client";

import { useState } from "react";
import {
  Building2,
  Waves,
  Trees,
  Milestone,
  TrainFront,
  Layers,
  Sun,
  ChevronDown,
  Search,
} from "lucide-react";
import { useMetroStore } from "@/stores/useMetroStore";
import type { CityLayers } from "@/types/city";
import StationSearch from "./StationSearch";

const LAYERS: { key: keyof CityLayers; label: string; icon: React.ReactNode }[] = [
  { key: "buildings", label: "Buildings", icon: <Building2 className="h-3.5 w-3.5" /> },
  { key: "roads", label: "Roads", icon: <Milestone className="h-3.5 w-3.5" /> },
  { key: "water", label: "Water", icon: <Waves className="h-3.5 w-3.5" /> },
  { key: "greenery", label: "Parks", icon: <Trees className="h-3.5 w-3.5" /> },
  { key: "metro", label: "Metro", icon: <TrainFront className="h-3.5 w-3.5" /> },
];

function formatClock(t: number): string {
  const total = Math.round(t * 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * World HUD: fly-to station search, layer visibility toggles, and a
 * time-of-day slider that drives the sky, sun, lighting and water.
 */
export default function WorldControls() {
  const layers = useMetroStore((s) => s.layers);
  const toggleLayer = useMetroStore((s) => s.toggleLayer);
  const timeOfDay = useMetroStore((s) => s.timeOfDay);
  const setTimeOfDay = useMetroStore((s) => s.setTimeOfDay);
  const selectStation = useMetroStore((s) => s.selectStation);
  const [open, setOpen] = useState(true);

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 hidden w-64 md:block">
      <div className="glass rounded-2xl p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={open}
        >
          <Layers className="h-4 w-4 text-[var(--ui-muted)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ui-muted)]">
            World
          </span>
          <ChevronDown
            className={
              "ml-auto h-4 w-4 text-[var(--ui-faint)] transition-transform " +
              (open ? "" : "-rotate-90")
            }
          />
        </button>

        {open && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ui-faint)]" />
              <div className="min-w-0 flex-1">
                <StationSearch
                  value={null}
                  onSelect={(id) => id && selectStation(id)}
                  placeholder="Fly to station..."
                  label="Fly to station"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {LAYERS.map((l) => {
                const on = layers[l.key];
                return (
                  <button
                    key={l.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleLayer(l.key)}
                    className={
                      "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors " +
                      (on
                        ? "bg-[var(--accent,#5a9dff)]/25 text-[var(--ui-fg)]"
                        : "bg-[var(--ui-active)] text-[var(--ui-faint)] hover:text-[var(--ui-fg)]")
                    }
                  >
                    {l.icon}
                    {l.label}
                  </button>
                );
              })}
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <Sun className="h-3.5 w-3.5 text-[var(--ui-faint)]" />
                <span className="text-[11px] text-[var(--ui-muted)]">Time of day</span>
                <span className="ml-auto text-[11px] tabular-nums text-[var(--ui-fg)]">
                  {formatClock(timeOfDay)}
                </span>
              </div>
              <input
                type="range"
                className="ui-range w-full"
                min={0}
                max={1}
                step={0.005}
                value={timeOfDay}
                aria-label="Time of day"
                onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
