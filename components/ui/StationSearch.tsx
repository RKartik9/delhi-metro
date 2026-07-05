"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useMetroStore } from "@/stores/useMetroStore";
import type { Station } from "@/types/metro";

interface StationSearchProps {
  value: string | null;
  onSelect: (id: string | null) => void;
  placeholder: string;
  /** Small color dot shown at the start of the field. */
  dotColor?: string;
  label: string;
}

const MAX_RESULTS = 7;

/** Accessible station combobox with fuzzy-ish prefix/substring autosuggest. */
export default function StationSearch({
  value,
  onSelect,
  placeholder,
  dotColor,
  label,
}: StationSearchProps) {
  const data = useMetroStore((s) => s.data);
  const hoverStation = useMetroStore((s) => s.hoverStation);

  const selectedName = value ? data?.stationsById[value]?.name ?? "" : "";

  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [prevValue, setPrevValue] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);

  // Sync the text field when the station changes from outside (swap/clear/commit).
  // Doing this during render (rather than in an effect) avoids cascading renders.
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(selectedName);
    setOpen(false);
  }

  const results = useMemo<Station[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts: Station[] = [];
    const contains: Station[] = [];
    for (const s of data?.stations ?? []) {
      const n = s.name.toLowerCase();
      if (n.startsWith(q)) starts.push(s);
      else if (n.includes(q)) contains.push(s);
      if (starts.length >= MAX_RESULTS) break;
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [query, data]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const commit = (station: Station) => {
    setQuery(station.name);
    setOpen(false);
    hoverStation(null);
    onSelect(station.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (results[active]) commit(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl bg-[var(--ui-active)] px-2.5 py-2 focus-within:ring-2 focus-within:ring-[color:var(--accent,#5a9dff)]/70">
        {dotColor && (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
          />
        )}
        <input
          value={query}
          placeholder={placeholder}
          aria-label={label}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${label}-listbox`}
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--ui-fg)] placeholder:text-[var(--ui-faint)] focus:outline-none"
        />
        {(query || value) && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => {
              setQuery("");
              onSelect(null);
              setOpen(false);
            }}
            className="grid h-5 w-5 place-items-center rounded-md text-[var(--ui-faint)] hover:text-[var(--ui-fg)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id={`${label}-listbox`}
          role="listbox"
          className="ui-scroll glass-strong absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl p-1"
        >
          {results.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => {
                  setActive(i);
                  hoverStation(s.id);
                }}
                onMouseLeave={() => hoverStation(null)}
                onClick={() => commit(s)}
                className={
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left " +
                  (i === active ? "bg-[var(--ui-active)]" : "")
                }
              >
                <span className="truncate text-[13px] text-[var(--ui-fg)]">
                  {s.name}
                </span>
                {s.interchange && (
                  <span className="ml-auto shrink-0 rounded-full bg-[var(--ui-hover)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--ui-faint)]">
                    Interchange
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
