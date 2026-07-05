"use client";

import { Eye, EyeOff, Layers } from "lucide-react";
import { useMetroStore } from "@/stores/useMetroStore";
import Legend from "./Legend";

/** Left sidebar: per-line visibility filters and selection. */
export default function LinesPanel() {
  const data = useMetroStore((s) => s.data);
  const hiddenLineIds = useMetroStore((s) => s.hiddenLineIds);
  const selectedLineId = useMetroStore((s) => s.selectedLineId);
  const selectLine = useMetroStore((s) => s.selectLine);
  const hoverLine = useMetroStore((s) => s.hoverLine);
  const toggleLineVisibility = useMetroStore((s) => s.toggleLineVisibility);
  const showAllLines = useMetroStore((s) => s.showAllLines);

  if (!data) return null;

  const anyHidden = hiddenLineIds.size > 0;

  return (
    <div className="glass pointer-events-auto flex max-h-[calc(100vh-13rem)] w-64 flex-col rounded-2xl">
      <header className="flex items-center justify-between px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--ui-muted)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-fg)]">
            Lines
          </span>
          <span className="text-[11px] tabular-nums text-[var(--ui-faint)]">
            {data.lines.length}
          </span>
        </div>
        <button
          type="button"
          onClick={showAllLines}
          disabled={!anyHidden}
          className="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--ui-muted)] transition-colors enabled:hover:bg-[var(--ui-hover)] enabled:hover:text-[var(--ui-fg)] disabled:opacity-35"
        >
          Show all
        </button>
      </header>

      <ul className="ui-scroll flex-1 overflow-y-auto px-2 pb-2">
        {data.lines.map((line) => {
          const hidden = hiddenLineIds.has(line.id);
          const selected = selectedLineId === line.id;
          return (
            <li key={line.id}>
              <div
                className={
                  "group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors " +
                  (selected ? "bg-[var(--ui-active)]" : "hover:bg-[var(--ui-hover)]")
                }
                onMouseEnter={() => hoverLine(line.id)}
                onMouseLeave={() => hoverLine(null)}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full transition-opacity"
                  style={{
                    background: line.color,
                    boxShadow: `0 0 8px ${line.color}`,
                    opacity: hidden ? 0.25 : 1,
                  }}
                />
                <button
                  type="button"
                  onClick={() => selectLine(selected ? null : line.id)}
                  className="flex min-w-0 flex-1 flex-col items-start text-left"
                >
                  <span
                    className={
                      "truncate text-[13px] leading-tight " +
                      (hidden
                        ? "text-[var(--ui-faint)]"
                        : "text-[var(--ui-fg)]")
                    }
                  >
                    {line.name}
                  </span>
                  <span className="text-[10px] tabular-nums text-[var(--ui-faint)]">
                    {line.route.length} stations
                  </span>
                </button>
                <button
                  type="button"
                  title={hidden ? "Show line" : "Hide line"}
                  aria-label={hidden ? "Show line" : "Hide line"}
                  onClick={() => toggleLineVisibility(line.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--ui-faint)] transition-colors hover:bg-[var(--ui-hover)] hover:text-[var(--ui-fg)]"
                >
                  {hidden ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-[var(--ui-border)] px-4 py-3">
        <Legend />
      </div>
    </div>
  );
}
