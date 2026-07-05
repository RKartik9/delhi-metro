"use client";

import { TrainFront, Sun, Moon, RotateCcw } from "lucide-react";
import { useMetroStore } from "@/stores/useMetroStore";

/** Top navigation: brand, live network stats, theme toggle, reset view. */
export default function TopBar() {
  const data = useMetroStore((s) => s.data);
  const theme = useMetroStore((s) => s.theme);
  const toggleTheme = useMetroStore((s) => s.toggleTheme);
  const resetView = useMetroStore((s) => s.resetView);

  const counts = data?.config.counts;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
      {/* Brand */}
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-2.5">
        <span
          className="grid h-8 w-8 place-items-center rounded-xl"
          style={{ background: "linear-gradient(135deg,#5a9dff,#8a5cff)" }}
        >
          <TrainFront className="h-4 w-4 text-white" strokeWidth={2.2} />
        </span>
        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-wide text-[var(--ui-fg)]">
            Delhi Metro
            <span className="ml-1 font-normal text-[var(--ui-muted)]">3D</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--ui-faint)]">
            Network Explorer
          </p>
        </div>

        {counts && (
          <div className="ml-2 hidden items-center gap-3 border-l border-[var(--ui-border)] pl-3 sm:flex">
            <Stat value={counts.lines} label="Lines" />
            <Stat value={counts.stations} label="Stations" />
            <Stat value={counts.interchanges} label="Interchanges" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5">
        <IconButton
          label="Reset view"
          onClick={resetView}
          icon={<RotateCcw className="h-4 w-4" />}
        />
        <IconButton
          label={theme === "night" ? "Switch to day" : "Switch to night"}
          onClick={toggleTheme}
          icon={
            theme === "night" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )
          }
        />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center leading-none">
      <div className="text-sm font-semibold tabular-nums text-[var(--ui-fg)]">
        {value}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--ui-faint)]">
        {label}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-xl text-[var(--ui-muted)] transition-colors hover:bg-[var(--ui-hover)] hover:text-[var(--ui-fg)]"
    >
      {icon}
    </button>
  );
}
