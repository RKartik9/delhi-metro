"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowLeftRight, LocateFixed, Layers, Footprints } from "lucide-react";
import { useMetroStore } from "@/stores/useMetroStore";
import { isInDetailZone } from "@/utils/streetSpawn";
import type { MetroLine, Station, StationLayout } from "@/types/metro";

const LAYOUT_COLOR: Record<StationLayout, string> = {
  Elevated: "#38bdf8",
  "At Grade": "#fbbf24",
  Underground: "#e879f9",
};

/** Right-hand contextual panel showing the selected line or station. */
export default function DetailsPanel() {
  const data = useMetroStore((s) => s.data);
  const selectedLineId = useMetroStore((s) => s.selectedLineId);
  const selectedStationId = useMetroStore((s) => s.selectedStationId);
  const clearSelection = useMetroStore((s) => s.clearSelection);

  const line = selectedLineId ? data?.linesById[selectedLineId] : null;
  const station = selectedStationId ? data?.stationsById[selectedStationId] : null;
  const open = Boolean(line || station);

  return (
    <div className="pointer-events-none absolute right-4 top-20 bottom-[15.5rem] flex w-72 justify-end">
      <AnimatePresence>
        {open && (
          <motion.div
            key={line ? `line-${line.id}` : `station-${station?.id}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="glass pointer-events-auto flex max-h-full w-full flex-col rounded-2xl"
          >
            {line && data && <LineDetails line={line} />}
            {station && data && <StationDetails station={station} />}

            <button
              type="button"
              aria-label="Close"
              onClick={clearSelection}
              className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-lg text-[var(--ui-faint)] transition-colors hover:bg-[var(--ui-hover)] hover:text-[var(--ui-fg)]"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LineDetails({ line }: { line: MetroLine }) {
  const data = useMetroStore((s) => s.data)!;
  const selectStation = useMetroStore((s) => s.selectStation);
  const hoverStation = useMetroStore((s) => s.hoverStation);

  const stations = line.stationIds
    .map((id) => data.stationsById[id])
    .filter(Boolean) as Station[];

  const breakdown = stations.reduce<Record<string, number>>((acc, s) => {
    acc[s.layout] = (acc[s.layout] ?? 0) + 1;
    return acc;
  }, {});
  const interchanges = stations.filter((s) => s.interchange).length;

  return (
    <>
      <header className="px-4 pb-3 pt-4">
        <div className="mb-1 flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: line.color, boxShadow: `0 0 10px ${line.color}` }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ui-faint)]">
            Metro Line
          </span>
        </div>
        <h2 className="pr-7 text-base font-semibold leading-tight text-[var(--ui-fg)]">
          {line.name}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>{stations.length} stations</Chip>
          <Chip icon={<ArrowLeftRight className="h-3 w-3" />}>
            {interchanges} interchange{interchanges === 1 ? "" : "s"}
          </Chip>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--ui-muted)]">
          {Object.entries(breakdown).map(([layout, n]) => (
            <span key={layout} className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-3 rounded-full"
                style={{ background: LAYOUT_COLOR[layout as StationLayout] }}
              />
              {n} {layout}
            </span>
          ))}
        </div>
      </header>

      <div className="ui-scroll flex-1 overflow-y-auto border-t border-[var(--ui-border)] px-2 py-2">
        <ol className="space-y-0.5">
          {stations.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => selectStation(s.id)}
                onMouseEnter={() => hoverStation(s.id)}
                onMouseLeave={() => hoverStation(null)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--ui-hover)]"
              >
                <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-[var(--ui-faint)]">
                  {i + 1}
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: line.color }}
                />
                <span className="truncate text-[12.5px] text-[var(--ui-fg)]">
                  {s.name}
                </span>
                {s.interchange && (
                  <ArrowLeftRight className="ml-auto h-3 w-3 shrink-0 text-[var(--ui-faint)]" />
                )}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function StationDetails({ station }: { station: Station }) {
  const data = useMetroStore((s) => s.data)!;
  const selectLine = useMetroStore((s) => s.selectLine);
  const hoverLine = useMetroStore((s) => s.hoverLine);
  const enterStreetView = useMetroStore((s) => s.enterStreetView);

  const lines = station.lines
    .map((id) => data.linesById[id])
    .filter(Boolean) as MetroLine[];

  const [sx, sy] = station.position;
  const walkable = isInDetailZone(sx, sy);

  return (
    <>
      <header className="px-4 pb-3 pt-4">
        <div className="mb-1 flex items-center gap-2">
          <LocateFixed className="h-3.5 w-3.5 text-[var(--ui-faint)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ui-faint)]">
            Station
          </span>
        </div>
        <h2 className="pr-7 text-base font-semibold leading-tight text-[var(--ui-fg)]">
          {station.name}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>
            <span
              className="mr-0.5 h-1.5 w-1.5 rounded-full"
              style={{ background: LAYOUT_COLOR[station.layout] }}
            />
            {station.layout}
          </Chip>
          {station.interchange && (
            <Chip icon={<ArrowLeftRight className="h-3 w-3" />}>Interchange</Chip>
          )}
        </div>
        {walkable && (
          <button
            type="button"
            onClick={() =>
              enterStreetView({ x: sx + 30, y: sy - 30, lookAt: [sx, sy] })
            }
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ui-active)] px-3 py-2 text-[12px] font-medium text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover)]"
          >
            <Footprints className="h-3.5 w-3.5" />
            Street view here
          </button>
        )}
      </header>

      <div className="border-t border-[var(--ui-border)] px-4 py-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ui-faint)]">
          <Layers className="h-3 w-3" /> Serves {lines.length} line
          {lines.length === 1 ? "" : "s"}
        </p>
        <div className="flex flex-col gap-1">
          {lines.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => selectLine(l.id)}
              onMouseEnter={() => hoverLine(l.id)}
              onMouseLeave={() => hoverLine(null)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--ui-hover)]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: l.color, boxShadow: `0 0 8px ${l.color}` }}
              />
              <span className="truncate text-[12.5px] text-[var(--ui-fg)]">
                {l.name}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-[10px] tabular-nums text-[var(--ui-faint)]">
          {station.lat.toFixed(4)}°N, {station.lng.toFixed(4)}°E
        </p>
      </div>
    </>
  );
}

function Chip({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ui-active)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--ui-fg)]">
      {icon}
      {children}
    </span>
  );
}
