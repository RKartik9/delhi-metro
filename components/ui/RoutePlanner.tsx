"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  Route,
  ArrowLeftRight,
  Clock,
  MapPin,
  Play,
  Pause,
} from "lucide-react";
import { useMetroStore } from "@/stores/useMetroStore";
import StationSearch from "./StationSearch";

/** Estimated journey time (min): ~2.2 min per hop + 4 min per transfer. */
function estimateMinutes(numStops: number, transfers: number): number {
  return Math.round(numStops * 2.2 + transfers * 4);
}

/** Top-center journey planner: from/to search, route summary, journey playback. */
export default function RoutePlanner() {
  const data = useMetroStore((s) => s.data);
  const fromStationId = useMetroStore((s) => s.fromStationId);
  const toStationId = useMetroStore((s) => s.toStationId);
  const setFromStation = useMetroStore((s) => s.setFromStation);
  const setToStation = useMetroStore((s) => s.setToStation);
  const swapStations = useMetroStore((s) => s.swapStations);
  const clearRoute = useMetroStore((s) => s.clearRoute);
  const route = useMetroStore((s) => s.route);
  const routeError = useMetroStore((s) => s.routeError);
  const journeyPlaying = useMetroStore((s) => s.journeyPlaying);
  const toggleJourney = useMetroStore((s) => s.toggleJourney);

  if (!data) return null;

  return (
    <div className="glass pointer-events-auto w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl p-2.5">
      <div className="mb-1 flex items-center gap-2 px-1.5 pt-0.5">
        <Route className="h-4 w-4 text-[var(--ui-muted)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ui-fg)]">
          Plan a journey
        </span>
        {(fromStationId || toStationId) && (
          <button
            type="button"
            onClick={clearRoute}
            className="ml-auto rounded-lg px-2 py-0.5 text-[11px] text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-fg)]"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <StationSearch
            value={fromStationId}
            onSelect={setFromStation}
            placeholder="From station"
            dotColor="#4ade80"
            label="Origin station"
          />
          <StationSearch
            value={toStationId}
            onSelect={setToStation}
            placeholder="To station"
            dotColor="#f87171"
            label="Destination station"
          />
        </div>
        <button
          type="button"
          onClick={swapStations}
          aria-label="Swap origin and destination"
          title="Swap"
          className="grid w-9 shrink-0 place-items-center rounded-xl bg-[var(--ui-active)] text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-fg)]"
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {routeError && (
          <motion.p
            key="err"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 px-1.5 text-[11px] text-amber-300"
          >
            {routeError}
          </motion.p>
        )}

        {route && (
          <motion.div
            key="route"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 rounded-xl bg-[var(--ui-hover)] p-2.5">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ui-muted)]">
                <Metric icon={<MapPin className="h-3 w-3" />}>
                  {route.numStops} stops
                </Metric>
                <Metric icon={<ArrowLeftRight className="h-3 w-3" />}>
                  {route.transfers} transfer{route.transfers === 1 ? "" : "s"}
                </Metric>
                <Metric icon={<Clock className="h-3 w-3" />}>
                  ~{estimateMinutes(route.numStops, route.transfers)} min
                </Metric>
                <span className="tabular-nums">{route.distanceKm.toFixed(1)} km</span>
              </div>

              {/* Line ribbon: one chip per segment, connected by transfer arrows. */}
              <div className="flex flex-wrap items-center gap-1">
                {route.segments.map((seg, i) => {
                  const line = data.linesById[seg.lineId];
                  return (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && (
                        <ArrowLeftRight className="h-3 w-3 text-[var(--ui-faint)]" />
                      )}
                      <span
                        className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium text-white"
                        style={{
                          background: line?.color ?? "#888",
                          boxShadow: `0 0 8px ${line?.color ?? "#888"}66`,
                        }}
                      >
                        {line?.name?.replace(/\s*Line$/i, "") ?? seg.lineId}
                        <span className="opacity-80">
                          {seg.stationIds.length}
                        </span>
                      </span>
                    </span>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={toggleJourney}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ui-active)] py-1.5 text-[12px] font-medium text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover)]"
              >
                {journeyPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Pause journey
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Replay journey
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1 tabular-nums text-[var(--ui-fg)]">
      {icon}
      {children}
    </span>
  );
}
