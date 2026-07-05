"use client";

import { useMemo } from "react";
import { useMetroStore } from "@/stores/useMetroStore";

const SIZE = 200;
const PAD = 14;

/** Top-down schematic minimap of the whole network, wired to filters/selection. */
export default function Minimap() {
  const data = useMetroStore((s) => s.data);
  const hiddenLineIds = useMetroStore((s) => s.hiddenLineIds);
  const selectedLineId = useMetroStore((s) => s.selectedLineId);
  const selectedStationId = useMetroStore((s) => s.selectedStationId);
  const selectLine = useMetroStore((s) => s.selectLine);
  const hoverLine = useMetroStore((s) => s.hoverLine);

  // Project scene X/Y (Z-up ground plane) into the SVG box; north stays up.
  const projected = useMemo(() => {
    if (!data) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const s of data.stations) {
      const [x, y] = s.position;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const span = Math.max(spanX, spanY);
    const inner = SIZE - PAD * 2;
    const offX = (span - spanX) / 2;
    const offY = (span - spanY) / 2;
    const toSvg = ([x, y]: readonly number[]): [number, number] => [
      PAD + ((x - minX + offX) / span) * inner,
      PAD + ((maxY - y + offY) / span) * inner, // flip Y so north is up
    ];

    const lines = data.lines.map((line) => ({
      id: line.id,
      color: line.color,
      points: line.stationIds
        .map((id) => data.stationsById[id])
        .filter(Boolean)
        .map((s) => toSvg(s.position).join(","))
        .join(" "),
    }));

    const interchanges = data.interchanges
      .map((it) => data.stationsById[it.id])
      .filter(Boolean)
      .map((s) => toSvg(s.position));

    return { lines, interchanges, toSvg };
  }, [data]);

  if (!data || !projected) return null;

  const selectedStation = selectedStationId
    ? data.stationsById[selectedStationId]
    : null;
  const marker = selectedStation
    ? projected.toSvg(selectedStation.position)
    : null;

  return (
    <div className="glass pointer-events-auto absolute bottom-4 right-4 rounded-2xl p-2">
      <svg
        width={176}
        height={176}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="block"
        role="img"
        aria-label="Network minimap"
      >
        {projected.lines.map((l) => {
          const hidden = hiddenLineIds.has(l.id);
          if (hidden) return null;
          const selected = selectedLineId === l.id;
          const dim = selectedLineId && !selected;
          return (
            <polyline
              key={l.id}
              points={l.points}
              fill="none"
              stroke={l.color}
              strokeWidth={selected ? 3 : 1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={dim ? 0.28 : 0.95}
              style={{ cursor: "pointer" }}
              onClick={() => selectLine(selected ? null : l.id)}
              onMouseEnter={() => hoverLine(l.id)}
              onMouseLeave={() => hoverLine(null)}
            />
          );
        })}

        {projected.interchanges.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={1.7}
            fill="#ffffff"
            opacity={selectedLineId ? 0.4 : 0.85}
            pointerEvents="none"
          />
        ))}

        {marker && (
          <g pointerEvents="none">
            <circle cx={marker[0]} cy={marker[1]} r={5} fill="none" stroke="#5a9dff" strokeWidth={1.5}>
              <animate attributeName="r" values="3;7;3" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.2;1" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={marker[0]} cy={marker[1]} r={2.4} fill="#5a9dff" />
          </g>
        )}
      </svg>
    </div>
  );
}
